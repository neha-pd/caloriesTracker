import { createHash } from "node:crypto";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      s.endpoint.length < 2048 &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".notify.windows.com")) &&
      /^[\w-]{80,100}$/.test(s.keys.p256dh) &&
      /^[\w-]{20,30}$/.test(s.keys.auth)
    );
  } catch {
    return false;
  }
}
export function validate(body) {
  if (!body || !["subscribe", "unsubscribe", "complete"].includes(body.action))
    throw Error("Unknown action");
  if (typeof body.token !== "string" || !/^[-a-f0-9]{72}$/.test(body.token))
    throw Error("Invalid device token");
  if (body.action !== "subscribe" && !/^[a-f0-9]{64}$/.test(body.id || ""))
    throw Error("Invalid subscription ID");
  if (body.action === "subscribe") {
    if (!validSubscription(body.subscription))
      throw Error("Unsupported push subscription");
    if (
      !Array.isArray(body.days) ||
      !body.days.length ||
      body.days.length > 5 ||
      body.days.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
    )
      throw Error("Choose 1–5 days");
    if (!/^(0[89]|1\d|2[01]):[0-5]\d$/.test(body.time || ""))
      throw Error("Choose a time between 08:00 and 21:59");
    if (typeof body.timezone !== "string" || body.timezone.length > 80)
      throw Error("Invalid timezone");
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone }).format();
    } catch {
      throw Error("Invalid timezone");
    }
  }
  if (
    body.action === "complete" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")
  )
    throw Error("Invalid date");
  return body;
}
export function localClock(timezone, now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minute: Number(p.hour) * 60 + Number(p.minute),
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}
export function due(sub, now = new Date()) {
  const clock = localClock(sub.timezone, now),
    [h, m] = sub.time.split(":").map(Number),
    delta = clock.minute - h * 60 - m;
  return sub.days.includes(clock.day) &&
    clock.minute >= 480 &&
    clock.minute < 1320 &&
    delta >= 0 &&
    delta < 30 &&
    sub.completedDate !== clock.date &&
    sub.sentDate !== clock.date
    ? clock.date
    : null;
}
export function message(sub) {
  return {
    title: "Your next little win",
    body:
      sub.tone === "playful"
        ? "Your workout saved you a spot. One comfortable set is a good start."
        : "Your planned workout is ready. Make a little time for yourself.",
    tag: "fitkin-workout",
    data: { url: "/train" },
  };
}
