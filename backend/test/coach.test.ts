import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayContext,
  parseTipIds,
  coachPrompt,
} from "../../mobile/src/features/coach/domain.js";
import {
  validateReminder,
  parseReminder,
  reminderWeekdays,
} from "../../mobile/src/features/reminderDomain.js";
import {
  reportLayout,
  weightDistance,
  wrapLabel,
} from "../../mobile/src/features/coach/reportData.js";
const base = {
  date: "2026-09-21",
  entries: [],
  water: [],
  complete: false,
  goals: { calories: 2000, protein: 100, carbs: 250, fat: 67, water: 2000 },
};
test("coach grounds review in available logs and rejects invented actions", () => {
  const c = dayContext(base);
  assert.equal(c.foodEntries, 0);
  assert.equal(c.loggingComplete, false);
  assert.ok(c.allowedTips.includes("log"));
  assert.ok(!c.allowedTips.includes("targets"));
  assert.match(coachPrompt(c), /Missing logs are not missing intake/);
  assert.deepEqual(
    parseTipIds(
      '```json\n{"tip_ids":["water","invented","water","reflect"]}\n```',
      c.allowedTips,
    ),
    ["water", "reflect"],
  );
  assert.throws(() =>
    parseTipIds('{"tip_ids":["prescribe_diet"]}', c.allowedTips),
  );
  assert.throws(() => parseTipIds("broken", c.allowedTips));
});
test("reminder drafts require valid times, cadence, wording and respect quiet hours", () => {
  const d = {
    title: "Water pause",
    body: "Take a moment for a sip.",
    hour: 15,
    minute: 30,
    cadence: "weekdays" as const,
    quietHours: true,
  };
  assert.equal(validateReminder(d).hour, 15);
  assert.deepEqual(reminderWeekdays("weekdays"), [2, 3, 4, 5, 6]);
  assert.deepEqual(reminderWeekdays("weekends"), [1, 7]);
  assert.deepEqual(reminderWeekdays("daily"), []);
  assert.throws(() => validateReminder({ ...d, hour: 23 }));
  assert.equal(
    validateReminder({ ...d, hour: 23, quietHours: false }).hour,
    23,
  );
  assert.throws(() => validateReminder({ ...d, minute: 60 }));
  assert.throws(() => validateReminder({ ...d, hour: NaN }));
  assert.throws(() => validateReminder({ ...d, title: " " }));
  assert.throws(() => parseReminder("{}"));
  assert.throws(() =>
    parseReminder(
      '{"title":"x","body":"y","hour":25,"minute":0,"cadence":"daily"}',
    ),
  );
  assert.equal(parseReminder(JSON.stringify(d)).cadence, "weekdays");
});
test("coach report preserves every food name and computes weight gap without a pace claim", () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    name: "Homemade bowl with rice and vegetables " + i,
    meal_type: i % 2 ? "lunch" : "dinner",
  })) as any;
  const layout = reportLayout(entries);
  assert.equal(layout.rows.filter((r) => r.kind === "food").length, 25);
  assert.ok(layout.height > 720);
  const long = "A".repeat(120);
  assert.equal(wrapLabel(long).join(""), long);
  assert.equal(weightDistance(72, 68), "4 kg above your chosen target.");
  assert.equal(weightDistance(60, 65), "5 kg below your chosen target.");
  assert.equal(weightDistance(65, 65), "At your chosen target weight.");
  assert.match(weightDistance(null, 65), /Add current/);
});
