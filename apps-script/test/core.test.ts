import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execute, type Identity, type Request } from "../src/core";
import { Store } from "../src/store";
import { recordSummary, validateRecords } from "../src/migration";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const time = Date.parse("2026-10-21T12:00:00Z");
function setup() {
  let store = new Store(),
    now = time;
  const env = {
    now: () => now,
    uuid: randomUUID,
    hash,
    chatAvailable: true,
    chat: (messages: any, context: any) => ({
      pendingChat: true,
      messages,
      context,
    }),
  };
  function run(identity: Identity, request: Request) {
    const next = new Store([...store.rows.values()]);
    const result = execute(next, identity, request, env);
    store = next;
    return result;
  }
  function user(uid: string = randomUUID()) {
    const identity = {
      uid,
      email: uid + "@example.com",
      authTime: time / 1000,
    };
    const { sheet_session, user } = run(identity, {
      method: "POST",
      path: "/api/auth/session",
      body: { display_name: "Friend", timezone: "UTC" },
    });
    const call = (
      method: string,
      path: string,
      body?: any,
      requestId = randomUUID(),
    ) =>
      run(identity, { method, path, body, requestId, session: sheet_session });
    return { identity, user, session: sheet_session, call };
  }
  return {
    user,
    run,
    store: () => store,
    clock: (n: number) => {
      now = n;
    },
  };
}
const meal = (id = randomUUID()) => ({
  id,
  log_date: "2026-10-21",
  name: "Idli",
  meal_type: "breakfast",
  quantity: 2,
  serving_unit: "piece",
  base_nutrition: { calories: 60, protein_g: 2, carbs_g: 12, fat_g: 1 },
  calories: 120,
  protein_g: 4,
  carbs_g: 24,
  fat_g: 2,
  source: "manual",
});
const workout = {
  kind: "workout",
  log_date: "2026-10-21",
  name: "Walk",
  start: "2026-10-21T08:00:00.000Z",
  minutes: 30,
  calories: 100,
  energyPolicy: "auto",
  notes: "",
};
test("existing Firebase identity keeps its app UUID; another email cannot claim it", () => {
  const s = setup(),
    a = s.user("firebase-a"),
    again = s.user("firebase-a"),
    b = s.user("firebase-b");
  assert.equal(a.user.id, again.user.id);
  assert.notEqual(a.user.id, b.user.id);
  assert.throws(
    () =>
      s.run(
        { ...b.identity, email: a.identity.email },
        { method: "GET", path: "/api/users/me", session: a.session },
      ),
    { status: 401 },
  );
  assert.equal(a.call("GET", "/api/users/me").user.firebase_uid, undefined);
});
test("expired, revoked, mismatched and logged-out sessions cannot read records", () => {
  const s = setup(),
    a = s.user();
  a.call("POST", "/api/auth/logout");
  assert.throws(() => a.call("GET", "/api/v3/snapshot"), { status: 401 });
  const b = s.user();
  s.clock(time + 31 * 86400000);
  assert.throws(() => b.call("GET", "/api/users/me"), { status: 401 });
});
test("food retry is idempotent for records and XP; patch replay does not conflict", () => {
  const s = setup(),
    a = s.user(),
    food = meal(),
    rid = randomUUID(),
    path = "/api/v2/entries/" + food.id;
  assert.equal(a.call("PUT", path, food, rid).awarded_xp, 35);
  assert.equal(a.call("PUT", path, food, rid).awarded_xp, 35);
  assert.equal(a.call("GET", "/api/v2/progress").xp, 35);
  assert.equal(a.call("GET", "/api/v3/snapshot").entries.length, 1);
  const patch = { version: 1, quantity: 3, meal_type: "lunch" },
    patchId = randomUUID();
  assert.equal(a.call("PATCH", path, patch, patchId).entry.calories, 180);
  assert.equal(a.call("PATCH", path, patch, patchId).entry.version, 2);
  assert.throws(() => a.call("PATCH", path, patch), { status: 409 });
  assert.throws(() => a.call("PUT", path, { ...food, name: "Other" }, rid), {
    status: 409,
  });
});
test("all collections and mutation IDs are isolated by owner", () => {
  const s = setup(),
    a = s.user(),
    b = s.user(),
    entry = meal();
  a.call("PUT", "/api/v2/entries/" + entry.id, entry);
  const wid = randomUUID(),
    fid = randomUUID(),
    cid = randomUUID();
  a.call("PUT", "/api/v2/water/" + wid, {
    log_date: "2026-10-21",
    amount_ml: 250,
  });
  a.call("PUT", "/api/v2/fitness/" + fid, workout);
  a.call("PUT", "/api/v2/foods/custom/" + cid, {
    name: "Home meal",
    serving_qty: 1,
    serving_unit: "bowl",
    calories: 100,
    protein_g: 5,
    carbs_g: 10,
    fat_g: 5,
  });
  for (const [path, body] of [
    ["entries/" + entry.id, entry],
    ["water/" + wid, { log_date: "2026-10-21", amount_ml: 200 }],
    ["fitness/" + fid, workout],
    ["foods/custom/" + cid, { name: "Other" }],
  ] as any[])
    assert.throws(() => b.call("PUT", "/api/v2/" + path, body), {
      status: 409,
    });
  for (const kind of ["entries", "water", "fitness", "foods"])
    assert.equal(b.call("GET", "/api/v3/snapshot")[kind].length, 0);
  assert.equal(b.call("GET", "/api/v2/progress").xp, 0);
});
test("fitness edits, weights, water and delete tombstones survive snapshot roundtrip", () => {
  const s = setup(),
    a = s.user(),
    id = randomUUID(),
    path = "/api/v2/fitness/" + id;
  const saved = a.call("PUT", path, workout).record;
  assert.equal(saved.version, 1);
  // A record loaded from sync can contain server metadata; it cannot alter ownership.
  const edited = a.call("PATCH", path, {
    ...saved,
    minutes: 40,
    version: 1,
  }).record;
  assert.equal(edited.minutes, 40);
  assert.equal(edited.version, 2);
  a.call("DELETE", path);
  assert.ok(a.call("GET", "/api/v3/snapshot").fitness[0].deleted_at);
  const weight = randomUUID();
  a.call("PUT", "/api/v2/fitness/" + weight, {
    kind: "weight",
    log_date: "2026-10-20",
    weightKg: 70,
  });
  assert.equal(a.call("GET", "/api/v3/snapshot").fitness.length, 2);
});
test("bad input commits nothing; nutrition ignores client-computed totals", () => {
  const s = setup(),
    a = s.user(),
    entry = meal();
  assert.throws(() =>
    a.call("PUT", "/api/v2/entries/" + entry.id, {
      ...entry,
      log_date: "2026-02-30",
    }),
  );
  assert.equal(a.call("GET", "/api/v3/snapshot").entries.length, 0);
  const result = a.call("PUT", "/api/v2/entries/" + entry.id, {
    ...entry,
    calories: 19999,
  });
  assert.equal(result.entry.calories, 120);
  assert.throws(
    () => a.call("PATCH", "/api/users/me", { timezone: "Not/A/Timezone" }),
    { status: 400 },
  );
});
test("personalized and manual targets persist without NaN", () => {
  const s = setup(),
    a = s.user();
  const result = a.call("PATCH", "/api/users/me/goals", {
    goal_type: "lose_weight",
    age: 30,
    gender: "female",
    height_cm: 165,
    weight_kg: 70,
    weight_goal_kg: 65,
    activity_level: "moderately_active",
  });
  assert.equal(result.maintenance_calories, 2201);
  assert.equal(result.user.calorie_goal, 1871);
  assert.equal(result.user.onboarding_complete, true);
  const manual = a.call("PATCH", "/api/users/me/goals", {
    goal_type: "maintain",
    calorie_goal: 2000,
    protein_goal_g: 100,
    carbs_goal_g: 250,
    fat_goal_g: 67,
  });
  assert.equal(manual.maintenance_calories, null);
  assert.equal(manual.user.calorie_goal, 2000);
});
test("XP caps food entries at 20 daily; hydration and check-in award once", () => {
  const s = setup(),
    a = s.user();
  for (let i = 0; i < 22; i++) {
    const f = meal();
    a.call("PUT", "/api/v2/entries/" + f.id, f);
  }
  for (let i = 0; i < 2; i++) {
    a.call("POST", "/api/v2/check-in");
    a.call("PUT", "/api/v2/water/" + randomUUID(), {
      log_date: "2026-10-21",
      amount_ml: 250,
    });
  }
  assert.equal(a.call("GET", "/api/v2/progress").xp, 250);
});
test("chat context respects consent and owner; pending reply cannot trigger duplicate inference", () => {
  const s = setup(),
    a = s.user(),
    b = s.user(),
    food = meal();
  a.call("PUT", "/api/v2/entries/" + food.id, food);
  const body = {
    date: "2026-10-21",
    messages: [{ role: "user", content: "How am I doing?" }],
    includeDiary: false,
  };
  const id = randomUUID(),
    result = a.call("POST", "/api/v2/chat", body, id);
  assert.deepEqual(result.context, { date: body.date, diaryShared: false });
  assert.throws(() => a.call("POST", "/api/v2/chat", body, id), {
    status: 425,
  });
  const receipt = s.store().get("receipt", a.user.id + "|" + id)!.value;
  assert.equal(receipt.messages, undefined);
  assert.equal(receipt.response, undefined);
  assert.equal(
    b.call("POST", "/api/v2/chat", { ...body, includeDiary: true }).context
      .foods.length,
    0,
  );
  assert.equal(
    a.call("POST", "/api/v2/chat", { ...body, includeDiary: true }).context
      .foods[0].name,
    "Idli",
  );
});
test("deletion removes private records and is retryable if Firebase is unavailable", () => {
  const s = setup(),
    a = s.user(),
    f = meal();
  a.call("PUT", "/api/v2/entries/" + f.id, f);
  assert.equal(a.call("DELETE", "/api/users/me").deleteFirebase, true);
  assert.equal(a.call("DELETE", "/api/users/me").deleteFirebase, true);
  assert.equal(s.store().list("entry", a.user.id).length, 0);
  assert.equal(s.store().list("xp", a.user.id).length, 0);
  assert.throws(() => a.call("GET", "/api/users/me"), { status: 403 });
  assert.equal(
    s.run(a.identity, { method: "POST", path: "/api/auth/session" })
      .deleteFirebase,
    true,
  );
});
test("migration hash is order-independent, detects changed records and validates owners", () => {
  const s = setup(),
    a = s.user(),
    f = meal();
  a.call("PUT", "/api/v2/entries/" + f.id, f);
  const rows = [...s.store().rows.values()].filter(
    (r) => !["session", "receipt"].includes(r.kind),
  );
  validateRecords(rows);
  assert.deepEqual(
    recordSummary(rows, hash),
    recordSummary([...rows].reverse(), hash),
  );
  const copy = JSON.parse(JSON.stringify(rows));
  copy.find((r: any) => r.kind === "entry").value.name = "Changed";
  assert.notEqual(
    recordSummary(copy, hash).digest,
    recordSummary(rows, hash).digest,
  );
  copy.find((r: any) => r.kind === "entry").owner = "other";
  assert.throws(() => validateRecords(copy), /owner/);
});
