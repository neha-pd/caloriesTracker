import test from "node:test";
import assert from "node:assert/strict";
import {
  dayRange,
  finiteMetric,
  workoutMinutes,
  restingFromSameSource,
} from "../../mobile/src/features/health/domain";
test("health uses local selected-day boundaries and rejects invalid or future dates", () => {
  const now = new Date("2026-09-21T12:00:00");
  const r = dayRange("2026-09-20", now);
  assert.equal(r.start.getHours(), 0);
  assert.equal(r.end.getDate(), 21);
  assert.throws(() => dayRange("2026-02-30", now));
  assert.throws(() => dayRange("2026-09-22", now));
  assert.equal(dayRange("2026-09-21", now).end.getTime(), now.getTime());
});
test("unknown is not zero, and resting energy requires consistent sources", () => {
  assert.equal(finiteMetric(undefined), null);
  assert.equal(finiteMetric(NaN), null);
  assert.equal(finiteMetric(-1), null);
  assert.equal(finiteMetric(0), 0);
  assert.equal(restingFromSameSource(2100, 400, ["watch"], ["watch"]), 1700);
  assert.equal(restingFromSameSource(2100, 400, ["watch"], ["phone"]), null);
  assert.equal(restingFromSameSource(200, 400, ["watch"], ["watch"]), null);
});
test("workouts overlapping each other or midnight do not double-count duration", () => {
  const w = (id: string, start: string, end: string) => ({
    id,
    name: "Walk",
    start,
    end,
    minutes: 60,
    source: "watch",
  });
  const workouts = [
    w("a", "2026-09-20T23:30:00", "2026-09-21T00:30:00"),
    w("b", "2026-09-21T00:15:00", "2026-09-21T00:45:00"),
  ];
  assert.equal(
    workoutMinutes(workouts, "2026-09-21", new Date("2026-09-22T12:00:00")),
    45,
  );
});
