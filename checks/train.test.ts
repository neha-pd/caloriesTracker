import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalog,
  generatePlans,
  initialProfile,
  volume,
  weekStats,
  createSession,
  calendarFile,
  validateProfile,
  getExercise,
} from "../mobile/src/features/train/domain";
const ready = { ...initialProfile, adult: true, clearance: true };
test("all catalog records are distinct and imported without media", () => {
  assert.equal(catalog.length, 1324);
  assert.equal(new Set(catalog.map((e) => e.id)).size, 1324);
  assert.ok(catalog.every((e) => !("image" in e) && !("gif_url" in e)));
});
test("automatic plans enforce readiness and movement preferences", () => {
  assert.throws(() => generatePlans(initialProfile));
  const p = generatePlans({ ...ready, avoid: ["knees"] });
  assert.ok(p.every((p) => p.exercises.every((e) => e.id !== "1685")));
  assert.throws(() =>
    generatePlans({ ...ready, avoid: ["knees", "back", "wrists", "ankles"] }),
  );
  assert.ok(validateProfile({ ...ready, days: [] }));
});
test("equipment and experience change recommendations without hidden supports", () => {
  const basic = generatePlans(ready)[0];
  assert.ok(
    basic.exercises.every(
      (e) => getExercise(e.id)?.equipment === "body weight",
    ),
  );
  const trained = generatePlans({
    ...ready,
    experience: "regular",
    equipment: ["body weight", "dumbbell"],
    minutes: 55,
  });
  assert.ok(
    trained.some((p) =>
      p.exercises.some((e) => getExercise(e.id)?.equipment === "dumbbell"),
    ),
  );
});
test("volume counts only completed loaded sets; partial sessions remain truthful", () => {
  const s = createSession(generatePlans(ready)[0], "test");
  s.sets[0] = { ...s.sets[0], done: true, reps: 8, kg: 12 };
  s.sets[1] = { ...s.sets[1], done: false, reps: 10, kg: 30 };
  assert.equal(volume(s.sets), 96);
  const now = new Date();
  s.finishedAt = +now;
  s.elapsedSeconds = 120;
  assert.equal(weekStats([s], now).minutes, 2);
  assert.equal(weekStats([s], now).sets, 1);
});
test("calendar encodes selected days and preferred local time", () => {
  const text = calendarFile({ ...ready, days: [1, 4], time: "18:45" });
  assert.match(text, /BYDAY=MO,TH/);
  assert.match(text, /T184500/);
  assert.match(text, /BEGIN:VALARM/);
});
