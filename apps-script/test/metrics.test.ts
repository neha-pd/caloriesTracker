import test from "node:test";
import assert from "node:assert/strict";
import { aggregateMetrics, routeLabel } from "../src/observability";
test("dashboard aggregates actual samples and route labels discard private path content", () => {
  const rows = [
    ["2026-10-21T00:00:00Z", "/api/v3/batch", 200, 100, 0, 40, 30, 3, 0, "a"],
    ["2026-10-21T01:00:00Z", "/api/v3/snapshot", 500, 300, 0, 40, 0, 0, 0, "a"],
    ["2026-10-21T02:00:00Z", "/api/v3/batch", 200, 200, 0, 40, 30, 2, 1, "b"],
  ];
  assert.deepEqual(aggregateMetrics(rows), [
    ["2026-10-21", 2, 3, 1, 5, 1, 200, 300],
  ]);
  assert.equal(routeLabel("/api/v2/entries/private-id"), "/api/v2/entries/:id");
  assert.equal(routeLabel("/api/v3/snapshot?token=secret"), "other");
  assert.equal(routeLabel("=IMPORTXML(secret)"), "other");
});
