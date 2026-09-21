import test from "node:test";
import assert from "node:assert/strict";
import {
  clockMinutes,
  isQuiet,
  validateNudges,
  defaultNudges,
  nudgeCopy,
} from "../../mobile/src/features/nudges/domain";
import { settingsSchema } from "../src/core/domain";
test("quiet hours wrap midnight, same-time disables quiet, and meal pickers reject quiet-hour overlap", () => {
  assert.equal(clockMinutes("19:30"), 1170);
  assert.throws(() => clockMinutes("24:00"));
  assert.equal(isQuiet(23 * 60, 22 * 60, 8 * 60), true);
  assert.equal(isQuiet(8 * 60, 22 * 60, 8 * 60), false);
  assert.equal(isQuiet(600, 540, 660), true);
  assert.equal(isQuiet(600, 540, 540), false);
  assert.throws(() => validateNudges({ ...defaultNudges, breakfast: "07:30" }));
  assert.throws(() => validateNudges({ ...defaultNudges, lunch: "08:30" }));
  assert.throws(() => validateNudges({ ...defaultNudges, fitness: 3 }));
  assert.equal(validateNudges(defaultNudges).dinner, "19:30");
});
test("step goals are personal, bounded, optional and do not change food goals", () => {
  assert.equal(settingsSchema.parse({ step_goal: 6000 }).step_goal, 6000);
  assert.throws(() => settingsSchema.parse({ step_goal: 0 }));
  assert.throws(() => settingsSchema.parse({ step_goal: 60001 }));
  assert.equal(settingsSchema.parse({ step_goal: null }).step_goal, null);
});
test("every dynamic category has rotating templates and only known factual placeholders", () => {
  for (const pool of Object.values(nudgeCopy)) {
    assert.ok(pool.length >= 2);
    assert.equal(new Set(pool.map((x) => x[1])).size, pool.length);
    for (const [title, body] of pool) {
      assert.ok(title.length <= 60 && body.length <= 220);
      for (const token of (title + body).matchAll(/\{([^}]+)\}/g))
        assert.ok(
          [
            "name",
            "steps",
            "goal",
            "remaining",
            "water",
            "workout",
            "minutes",
          ].includes(token[1]),
        );
    }
  }
});
