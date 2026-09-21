import test from "node:test";
import assert from "node:assert/strict";
import {
  assistantText,
  parseFoodSuggestions,
} from "../../mobile/src/features/aiDomain";
import {
  boundedHistory,
  conversationContext,
  conversationSystem,
} from "../../mobile/src/features/chat/domain";
import { parseReminder } from "../../mobile/src/features/reminderDomain";
import { parseTipIds } from "../../mobile/src/features/coach/domain";
test("food model accepts JSON, objects, bullet lists, prose prefixes, and truncated JSON", () => {
  for (const response of [
    '["dosa","sambar","coconut chutney"]',
    '```json\n{"foods":[{"name":"dosa"},{"name":"sambar"},{"name":"coconut chutney"}]}\n```',
    "- dosa\n- sambar\n- coconut chutney",
    "Foods: dosa, sambar, coconut chutney",
  ])
    assert.deepEqual(parseFoodSuggestions(response), [
      "dosa",
      "sambar",
      "coconut chutney",
    ]);
  assert.deepEqual(parseFoodSuggestions('["dosa", "sambar",'), [
    "dosa",
    "sambar",
  ]);
  assert.deepEqual(parseFoodSuggestions("Savoury rice\n".repeat(40)), []);
  assert.deepEqual(parseFoodSuggestions("NO FOOD"), []);
  assert.deepEqual(parseFoodSuggestions("[]"), []);
  assert.deepEqual(parseFoodSuggestions("I cannot identify the photo."), []);
  assert.deepEqual(parseFoodSuggestions("dosa\ndosa\n500 kcal"), ["dosa"]);
});
test("assistant extraction retains mixed text content and only the current answer", () => {
  assert.equal(
    assistantText([
      { role: "assistant", content: "old" },
      { role: "user", content: "hi" },
      { role: "assistant", content: ["Hello", { kind: "image" }, "there"] },
    ]),
    "Hello there",
  );
  assert.equal(
    assistantText([
      { role: "assistant", content: "<think>private reasoning</think>Ready." },
    ]),
    "Ready.",
  );
  assert.equal(assistantText([{ role: "user", content: "hi" }]), "");
});
test("chat context grounds totals, preserves missing activity, excludes deleted/other days and bounds memory", () => {
  const c = conversationContext(
    {
      date: "2026-09-21",
      entries: [
        {
          log_date: "2026-09-21",
          name: "Dosa",
          calories: 200,
          protein_g: 5,
          carbs_g: 30,
          fat_g: 8,
          meal_type: "breakfast",
        },
        { log_date: "2026-09-21", deleted_at: "x", calories: 999 },
        { log_date: "2026-09-20", calories: 999 },
      ] as any,
      water: [],
      complete: false,
      goals: { calories: 2000, protein: 100, carbs: 250, fat: 70, water: 2000 },
    },
    { display_name: "Neha", weight_kg: 70, weight_goal_kg: 65 },
    { steps: 1000, activeCalories: 60, lastSync: "2026-09-20T12:00:00Z" },
  );
  assert.equal(c.totals.calories, 200);
  assert.equal(c.foods.length, 1);
  assert.equal(c.weightDifferenceKg, -5);
  assert.equal(c.activity.steps, null);
  assert.equal(c.loggingComplete, false);
  assert.match(conversationSystem(c), /Missing data is unknown/);
  assert.equal(
    boundedHistory(
      Array.from({ length: 20 }, () => ({
        role: "user",
        content: "x".repeat(2000),
      })),
    ).length,
    4,
  );
  assert.equal(
    boundedHistory([{ role: "user", content: "x".repeat(2000) }])[0].content
      .length,
    500,
  );
});
test("structured AI routes reject invalid actions and accept valid model drafts", () => {
  assert.deepEqual(
    parseTipIds('{"tip_ids":["water","invented","water"]}', ["water"]),
    ["water"],
  );
  const d = parseReminder(
    '```json\n{"title":"Water","body":"Take a sip","hour":15,"minute":30,"cadence":"weekdays"}\n```',
  );
  assert.equal(d.hour, 15);
  assert.equal(d.quietHours, true);
  assert.throws(() =>
    parseReminder(
      '{"title":"Water","body":"Sip","hour":26,"minute":0,"cadence":"daily"}',
    ),
  );
});

test("real native model role labels and quoted numeric reminder times normalize safely", () => {
  assert.equal(
    assistantText([{ role: "assistant", content: "assistant\nHello there." }]),
    "Hello there.",
  );
  const raw =
    '{"title":"Water","body":"Take a sip","hour":"15","minute":"00","cadence":"weekdays"}';
  assert.equal(parseReminder(raw).hour, 15);
  assert.equal(parseReminder(raw).minute, 0);
  assert.throws(() => parseReminder(raw.replace('"15"', '""')));
});

test("reminder times come from explicit user input, not invented model fields", () => {
  const text =
    '{"title":"Water","body":"Take a sip","hour":4,"minute":19,"cadence":"weekends"}';
  const draft = parseReminder(text, "water at 3 pm on weekdays");
  assert.equal(draft.hour, 15);
  assert.equal(draft.minute, 0);
  assert.equal(draft.cadence, "weekdays");
  assert.equal(parseReminder(text, "water at 15:30").minute, 30);
  assert.throws(() => parseReminder(text, "water in the afternoon"));
  assert.throws(() => parseReminder(text, "water at 3 pm and 5 pm"));
});

test("first-user regular interval request produces a reviewable water schedule without AI", async () => {
  const {
    localReminderDraft,
    reminderTimes,
    reminderWeekdays,
    validateReminder,
  } = await import("../../mobile/src/features/reminderDomain");
  const d = localReminderDraft("Drink water at regular intervals in 24hrs");
  assert.equal(d.title, "Water break");
  assert.equal(d.intervalHours, 2);
  assert.deepEqual(
    reminderTimes(d).map((t) => t.hour),
    [8, 10, 12, 14, 16, 18, 20],
  );
  assert.equal(reminderTimes({ ...d, quietHours: false }).length, 12);
  const weekday = localReminderDraft("Drink water every 3 hours on weekdays");
  assert.equal(weekday.intervalHours, 3);
  assert.equal(
    reminderTimes(weekday).length * reminderWeekdays(weekday.cadence).length,
    25,
  );
  assert.equal(localReminderDraft("Water every hour").intervalHours, 1);
  assert.throws(() => localReminderDraft("water every 30 minutes"));
  assert.throws(() =>
    localReminderDraft("water every 2 hours from 9 am to 8 pm"),
  );
  assert.throws(() => localReminderDraft("water every 2 hours for 24 hours"));
  assert.throws(() => validateReminder({ ...d, intervalHours: 0 }));
  assert.throws(() => validateReminder({ ...d, intervalHours: 1.5 }));
  assert.equal(localReminderDraft("water at 3 pm").intervalHours, undefined);
});
