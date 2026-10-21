import test from "node:test";
import assert from "node:assert/strict";
import { reminderCalendar } from "../mobile/src/features/reminderCalendar";
const draft = {
  title: "Water",
  body: "Take a sip",
  hour: 8,
  minute: 0,
  cadence: "daily" as const,
  quietHours: true,
};
test("web calendar exports recurring alarms without pretending to schedule notifications", () => {
  const text = reminderCalendar(
    [{ ...draft, intervalHours: 2 }],
    new Date(2026, 9, 21, 9),
  );
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 7);
  assert.equal((text.match(/BEGIN:VALARM/g) || []).length, 7);
  assert.match(text, /RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA/);
  assert.match(text, /DTSTART:20261022T080000/);
  assert.doesNotMatch(text, /T(?:22|23|00|02|04|06)0000/);
});
test("web calendar escapes injected fields, folds Unicode and validates schedules", () => {
  const text = reminderCalendar(
    [
      {
        ...draft,
        title: "नमस्ते ".repeat(5),
        body: "Hello\nBEGIN:VEVENT;one,two\\three",
        cadence: "weekdays",
      },
    ],
    new Date(2026, 9, 23, 10),
  );
  assert.match(text, /DTSTART:20261026T080000/);
  assert.match(text, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.equal((text.match(/\r\nBEGIN:VEVENT/g) || []).length, 1);
  assert.ok(text.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  assert.throws(() => reminderCalendar([{ ...draft, hour: 25 }]), /valid/);
  assert.throws(() => reminderCalendar([]), /between/);
});
