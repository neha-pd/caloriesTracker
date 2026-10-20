/** Read-only snapshot. No account, database, or cloud resources are changed. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { recordSummary, validateRecords } from "./src/migration";
import { normalizeEntry, safeUser } from "../shared/validation";
import type { Row } from "./src/store";
const credentials = JSON.parse(
  fs.readFileSync(
    process.env.FITKIN_SOURCE_FILE || ".data/migration-source.json",
    "utf8",
  ),
);
const out = path.resolve(
  process.env.FITKIN_EXPORT_DIR ||
    ".data/migration-" + new Date().toISOString().replace(/[:.]/g, "-"),
);
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const save = (name: string, value: unknown) => {
  const file = path.join(out, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
};
const connection = new URL(credentials.database_url);
connection.searchParams.set("sslmode", "verify-full");
const db = new pg.Client({
  connectionString: connection.toString(),
  connectionTimeoutMillis: 30000,
  statement_timeout: 60000,
});
const tables = [
  "users",
  "entries_v2",
  "water_entries",
  "fitness_records",
  "custom_foods",
  "xp_events",
  "sessions",
  "password_resets",
];
let snapshot: Record<string, any[]> = {};
await db.connect();
try {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  for (const table of tables)
    snapshot[table] = (await db.query("SELECT * FROM " + table)).rows;
  await db.query("COMMIT");
} finally {
  await db.end();
}
// Complete original backup includes legacy sessions. It stays local and is NEVER uploaded.
save("private-postgres-backup.json", snapshot);
const account =
  typeof credentials.firebase_service_account === "string"
    ? JSON.parse(credentials.firebase_service_account)
    : credentials.firebase_service_account;
if (account.project_id !== "fitlens-b37f6")
  throw Error("Unexpected Firebase project.");
const auth = getAuth(initializeApp({ credential: cert(account) }));
const firebase: any[] = [];
let page: string | undefined;
do {
  const result = await auth.listUsers(1000, page);
  firebase.push(
    ...result.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
    })),
  );
  page = result.pageToken;
} while (page);
save("private-firebase-identities.json", firebase);
const identities = new Map(firebase.map((u) => [u.uid, u])),
  rows: Row[] = [],
  linked = new Set<string>();
for (const u of snapshot.users) {
  if (!u.firebase_uid || !identities.has(u.firebase_uid))
    throw Error(
      "A database account has no matching Firebase identity. Backup saved; reconcile identities before migration.",
    );
  if (linked.has(u.firebase_uid)) throw Error("Duplicate Firebase identity.");
  linked.add(u.firebase_uid);
  rows.push({
    kind: "user",
    id: u.id,
    owner: u.firebase_uid,
    value: { ...safeUser(u), firebase_uid: u.firebase_uid },
  });
}
// Firebase-only signups retain their login; no credentials are copied or recreated.
for (const u of firebase)
  if (!linked.has(u.uid)) {
    if (!u.email)
      throw Error("A Firebase account has no email; review before migration.");
    const id = randomUUID(),
      created = new Date(u.createdAt).toISOString();
    rows.push({
      kind: "user",
      id,
      owner: u.uid,
      value: {
        id,
        firebase_uid: u.uid,
        email: u.email.toLowerCase(),
        display_name: u.displayName || "Friend",
        timezone: "UTC",
        age: null,
        gender: null,
        height_cm: null,
        weight_kg: null,
        weight_goal_kg: null,
        activity_level: null,
        goal_type: null,
        calorie_goal: 2000,
        protein_goal_g: 100,
        carbs_goal_g: 250,
        fat_goal_g: 67,
        onboarding_complete: false,
        settings: {
          water_goal_ml: 2000,
          meal_reminders: false,
          water_reminders: false,
          quest_reminders: false,
          haptics: true,
        },
        created_at: created,
        updated_at: created,
      },
    });
  }
for (const [table, kind] of Object.entries({
  entries_v2: "entry",
  water_entries: "water",
  fitness_records: "fitness",
  custom_foods: "food",
  xp_events: "xp",
}))
  for (const item of snapshot[table]) {
    let value = JSON.parse(JSON.stringify(item));
    if (kind === "entry" || kind === "food") {
      value = normalizeEntry(value);
      if (value.serving_qty != null)
        value.serving_qty = Number(value.serving_qty);
    }
    if (kind === "fitness") {
      const { data, ...rest } = value;
      value = { ...data, ...rest };
    }
    const id =
      kind === "xp"
        ? [value.user_id, value.log_date, value.event_key].join("|")
        : value.id;
    rows.push({ kind, id, owner: value.user_id, value });
  }
// Normalize PostgreSQL Date objects before hashing the exact JSON that will be imported.
rows.splice(0, rows.length, ...JSON.parse(JSON.stringify(rows)));
validateRecords(rows);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const manifest = {
  schema: 1,
  exportedAt: new Date().toISOString(),
  source: "fitlens-b37f6",
  summary: recordSummary(rows, hash),
};
save("fitkin-migration.json", { manifest, rows });
save("migration-report.json", {
  exportedAt: manifest.exportedAt,
  postgresAccounts: snapshot.users.length,
  firebaseAccounts: firebase.length,
  firebaseOnlyAccounts: firebase.length - linked.size,
  records: manifest.summary.count,
  counts: manifest.summary.counts,
  digest: manifest.summary.digest,
  notes: [
    "Firebase passwords remain in the existing Firebase project.",
    "Sessions and password-reset tokens are backed up locally but excluded from the Google Sheet.",
    "Phone-only Health Connect history, training plans and pending offline edits stay on the original devices.",
    "This is a point-in-time snapshot. Stop old writes and export again before final cutover.",
  ],
});
console.log(
  JSON.stringify(
    {
      directory: out,
      postgresAccounts: snapshot.users.length,
      firebaseAccounts: firebase.length,
      records: manifest.summary.count,
      counts: manifest.summary.counts,
    },
    null,
    2,
  ),
);
