import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRequests } from "../src/dashboard";
test("HTML dashboard summaries filter periods, handle empty data, and strip account identifiers", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const data = summarizeRequests(
    [
      [
        "2026-10-21T10:00:00Z",
        "/api/v3/batch",
        200,
        100,
        1,
        30,
        20,
        3,
        1,
        "actor-a",
      ],
      [
        "2026-10-21T11:00:00Z",
        "/api/v3/snapshot",
        500,
        300,
        4,
        40,
        0,
        0,
        0,
        "actor-a",
      ],
      [
        "2026-10-19T10:00:00Z",
        "/api/v3/batch",
        200,
        800,
        10,
        30,
        20,
        2,
        0,
        "actor-b",
      ],
      [
        "2027-01-01T10:00:00Z",
        "/api/v3/batch",
        200,
        900,
        10,
        30,
        20,
        2,
        0,
        "actor-c",
      ],
    ],
    now,
    1,
  );
  assert.equal(data.requests, 2);
  assert.equal(data.activeAccounts, 1);
  assert.equal(data.errors, 1);
  assert.equal(data.operations, 3);
  assert.equal(data.rejected, 1);
  assert.equal(data.median, 100);
  assert.equal(data.p95, 300);
  assert.equal(data.daily.length, 1);
  assert(!JSON.stringify(data).includes("actor-a"));
  const empty = summarizeRequests([], now, 7);
  assert.equal(empty.median, null);
  assert.equal(empty.p95, null);
  assert.equal(empty.requests, 0);
  assert.equal(empty.timing.total, null);
});
