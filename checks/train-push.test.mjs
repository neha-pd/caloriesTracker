import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validate,
  validSubscription,
  due,
  localClock,
} from "../netlify/lib/train-push.mjs";
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
};
const body = {
  action: "subscribe",
  token: "a".repeat(72),
  subscription,
  days: [1],
  time: "18:00",
  timezone: "Asia/Kolkata",
};
test("push input refuses private/foreign endpoints, invalid dates and schedules", () => {
  assert.ok(validSubscription(subscription));
  assert.ok(
    !validSubscription({
      ...subscription,
      endpoint: "http://127.0.0.1/secret",
    }),
  );
  assert.ok(
    !validSubscription({ ...subscription, endpoint: "https://evil.example/" }),
  );
  assert.throws(() => validate({ ...body, time: "23:30" }));
  assert.throws(() => validate({ ...body, days: [9] }));
  assert.throws(() => validate({ ...body, timezone: "invented" }));
  assert.deepEqual(validate(body), body);
});
test("reminders use local timezone, bounded lateness and completion suppression", () => {
  const now = new Date("2026-10-12T12:35:00Z");
  assert.equal(localClock("Asia/Kolkata", now).minute, 1085);
  assert.equal(due(body, now), "2026-10-12");
  assert.equal(due({ ...body, completedDate: "2026-10-12" }, now), null);
  assert.equal(due({ ...body, sentDate: "2026-10-12" }, now), null);
  assert.equal(due(body, new Date("2026-10-12T13:15:00Z")), null);
  assert.equal(due(body, new Date("2026-10-13T12:35:00Z")), null);
});
test("timezone follows daylight saving, not a fixed browser offset", () => {
  assert.equal(
    localClock("America/New_York", new Date("2026-07-01T12:00:00Z")).minute,
    480,
  );
  assert.equal(
    localClock("America/New_York", new Date("2026-12-01T12:00:00Z")).minute,
    420,
  );
});
