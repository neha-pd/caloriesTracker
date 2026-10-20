import type { Row } from "./store";
export function canonical(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") +
    "}"
  );
}
export function recordSummary(rows: Row[], hash: (s: string) => string) {
  const sorted = [...rows].sort((a, b) =>
    (a.kind + ":" + a.id).localeCompare(b.kind + ":" + b.id, "en"),
  );
  // Sort code points explicitly so Node and Apps Script locales cannot change the digest.
  sorted.sort((a, b) =>
    a.kind + ":" + a.id < b.kind + ":" + b.id
      ? -1
      : a.kind + ":" + a.id > b.kind + ":" + b.id
        ? 1
        : 0,
  );
  const counts: Record<string, number> = {},
    owners: Record<string, Record<string, number>> = {};
  for (const r of sorted) {
    counts[r.kind] = (counts[r.kind] || 0) + 1;
    const o = owners[r.owner] || (owners[r.owner] = {});
    o[r.kind] = (o[r.kind] || 0) + 1;
  }
  return {
    count: rows.length,
    counts,
    owners,
    digest: hash(sorted.map((r) => hash(canonical(r))).join("\n")),
  };
}
export function validateRecords(rows: Row[]) {
  const keys = new Set<string>(),
    firebase = new Set<string>(),
    users = new Set(rows.filter((r) => r.kind === "user").map((r) => r.id));
  for (const r of rows) {
    if (
      !["user", "entry", "water", "fitness", "food", "xp"].includes(r.kind) ||
      !r.id ||
      !r.owner ||
      !r.value ||
      typeof r.value !== "object"
    )
      throw Error("Invalid migration record.");
    const key = r.kind + ":" + r.id;
    if (keys.has(key)) throw Error("Duplicate migration identifier.");
    keys.add(key);
    if (r.kind === "user") {
      if (
        r.value.id !== r.id ||
        r.value.firebase_uid !== r.owner ||
        firebase.has(r.owner)
      )
        throw Error("Account identity mismatch.");
      firebase.add(r.owner);
      if ("password_hash" in r.value || "google_id" in r.value)
        throw Error("Legacy authentication secrets must not be imported.");
    } else if (!users.has(r.owner) || r.value.user_id !== r.owner)
      throw Error("Orphaned or mismatched owner in migration.");
    if (r.kind !== "user" && r.kind !== "xp" && r.value.id !== r.id)
      throw Error("Record identifier mismatch.");
    if (
      r.kind === "xp" &&
      r.id !== [r.owner, r.value.log_date, r.value.event_key].join("|")
    )
      throw Error("XP identifier mismatch.");
    if (canonical(r.value).length > 45000)
      throw Error("Record exceeds the spreadsheet cell limit.");
  }
}
