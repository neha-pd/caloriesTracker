export type Cadence = "daily" | "weekdays" | "weekends";
export interface ReminderDraft {
  title: string;
  body: string;
  hour: number;
  minute: number;
  cadence: Cadence;
  quietHours: boolean;
  intervalHours?: number;
}
export interface CustomReminder extends ReminderDraft {
  id: string;
  notificationIds: string[];
  enabled: boolean;
  createdAt: string;
}
export function validateReminder(d: ReminderDraft) {
  if (!d.title.trim() || d.title.length > 60)
    throw new Error("Use a reminder title between 1 and 60 characters.");
  if (!d.body.trim() || d.body.length > 180)
    throw new Error("Use a message between 1 and 180 characters.");
  if (
    !Number.isInteger(d.hour) ||
    d.hour < 0 ||
    d.hour > 23 ||
    !Number.isInteger(d.minute) ||
    d.minute < 0 ||
    d.minute > 59
  )
    throw new Error("Enter a valid 24-hour time, such as 15:30.");
  if (!["daily", "weekdays", "weekends"].includes(d.cadence))
    throw new Error("Choose a valid repeat schedule.");
  if (
    d.intervalHours !== undefined &&
    (!Number.isInteger(d.intervalHours) ||
      d.intervalHours < 1 ||
      d.intervalHours > 12)
  )
    throw new Error("Choose an interval between 1 and 12 whole hours.");
  if (!d.intervalHours && d.quietHours && (d.hour >= 22 || d.hour < 8))
    throw new Error(
      "Quiet hours are 22:00–08:00. Choose a daytime time or turn quiet hours off for this reminder.",
    );
  return { ...d, title: d.title.trim(), body: d.body.trim() };
}
export function reminderWeekdays(cadence: Cadence): number[] {
  return cadence === "weekdays"
    ? [2, 3, 4, 5, 6]
    : cadence === "weekends"
      ? [1, 7]
      : [];
}
export function reminderSchedule(request: string) {
  if (
    /\b(?:tomorrow|today|tonight|once|UTC|GMT|IST|PST|EST|CET)\b|\bfor (?:the next )?\d+\s*(?:hours?|hrs?|days?)\b/i.test(
      request,
    )
  )
    throw new Error(
      "This editor repeats daily, on weekdays or weekends. One-off schedules and timezone conversions need manual review.",
    );
  if (
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      request,
    )
  )
    throw new Error(
      "Choose daily, weekdays or weekends. Individual weekdays are not supported yet.",
    );
  const weekend = /\bweekends?\b/i.test(request),
    weekday = /\bweekdays?\b/i.test(request);
  if (weekend && weekday) throw new Error("Choose one repeat schedule.");
  const cadence: Cadence = weekend
    ? "weekends"
    : weekday
      ? "weekdays"
      : "daily";
  if (/\bevery\s+\d+\s*(?:minutes?|mins?|days?)\b/i.test(request))
    throw new Error("Choose an hourly interval from 1 to 12 hours.");
  const intervals = [
    ...request.matchAll(/\bevery\s+(?:(\d+)\s*)?(hours?|hrs?)\b/gi),
  ];
  const regular =
    /\bregular\s+intervals?\b|\bthroughout\s+(?:the\s+)?day\b|\bhourly\b/i.test(
      request,
    );
  if (intervals.length > 1)
    throw new Error("Choose one interval per reminder.");
  if (intervals.length || regular) {
    if (
      /\b\d{1,2}(?::\d{2})?\s*[ap]\.?m|\b\d{1,2}:\d{2}\b|\b(?:from|until|starting|between)\b/i.test(
        request,
      )
    )
      throw new Error(
        "For interval reminders, choose the spacing below. Quiet hours control the daily delivery window; custom start/end times are not supported yet.",
      );
    const intervalHours = intervals.length
      ? Number(intervals[0][1] || 1)
      : /\bhourly\b/i.test(request)
        ? 1
        : 2;
    if (intervalHours < 1 || intervalHours > 12)
      throw new Error("Choose an interval between 1 and 12 whole hours.");
    return { hour: 8, minute: 0, cadence, intervalHours };
  }
  if (
    /\bintervals?\b|\bevery\s+(?:\d+|one|two|three|four|five|half)\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/i.test(
      request,
    )
  )
    throw new Error(
      "Use an hourly interval such as every 2 hours, or choose the interval below.",
    );
  const matches = [
    ...request.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)/gi),
  ];
  let hour: number, minute: number;
  const extraClocks = [
    ...request.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g),
  ].filter(
    (clock) =>
      !matches.some(
        (match) =>
          clock.index! >= match.index! &&
          clock.index! < match.index! + match[0].length,
      ),
  );
  if (matches.length && extraClocks.length)
    throw new Error("Use one time per reminder.");
  if (matches.length === 1) {
    const match = matches[0],
      clock = Number(match[1]);
    if (clock < 1 || clock > 12)
      throw new Error("Use a time such as 3 pm or 15:30.");
    hour = (clock % 12) + (/^p/i.test(match[3]) ? 12 : 0);
    minute = Number(match[2] || 0);
  } else {
    const clocks = [...request.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)];
    if (matches.length || clocks.length !== 1)
      throw new Error(
        "Include one explicit time, such as 3 pm or 15:30. Use separate reminders for multiple times.",
      );
    hour = Number(clocks[0][1]);
    minute = Number(clocks[0][2]);
  }
  return { hour, minute, cadence, intervalHours: undefined };
}
export function parseReminder(text: string, request?: string): ReminderDraft {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error(
      "Could not understand the reminder. Try including a time, or use the manual fields.",
    );
  let raw: any;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    throw new Error(
      "The reminder draft was incomplete. Try again or edit manually.",
    );
  }
  if (typeof raw.title !== "string" || typeof raw.body !== "string")
    throw new Error("The reminder needs a title and message.");
  return validateReminder({
    title: raw.title,
    body: raw.body,
    hour:
      typeof raw.hour === "string" && /^\d{1,2}$/.test(raw.hour)
        ? Number(raw.hour)
        : raw.hour,
    minute:
      typeof raw.minute === "string" && /^\d{1,2}$/.test(raw.minute)
        ? Number(raw.minute)
        : raw.minute,
    cadence: raw.cadence,
    ...(request !== undefined ? reminderSchedule(request) : {}),
    quietHours: true,
  });
}
export function reminderPrompt(request: string) {
  reminderSchedule(request);
  return `Write friendly notification wording for this request: ${JSON.stringify(request.slice(0, 400))}. Return only a JSON object with two fields: "title" (under 60 characters) and "body" (under 180 characters). Example for a water reminder: {"title":"Water break","body":"Pause for a sip of water."}. Describe the action, not just the clock time. Do not add medical advice or dosages. Do not schedule anything. The app separately handles the time and repeat schedule.`;
}

export function reminderTimes(
  d: Pick<ReminderDraft, "hour" | "minute" | "quietHours" | "intervalHours">,
) {
  if (d.intervalHours === undefined)
    return [{ hour: d.hour, minute: d.minute }];
  if (
    !Number.isInteger(d.intervalHours) ||
    d.intervalHours < 1 ||
    d.intervalHours > 12
  )
    return [];
  const times: { hour: number; minute: number }[] = [];
  for (
    let hour = d.quietHours ? 8 : 0;
    hour < (d.quietHours ? 22 : 24);
    hour += d.intervalHours
  )
    times.push({ hour, minute: 0 });
  return times;
}
export function localReminderDraft(request: string): ReminderDraft {
  const schedule = reminderSchedule(request);
  const water = /\bwater|hydrate|hydration\b/i.test(request);
  return validateReminder({
    ...schedule,
    title: water ? "Water break" : "Your reminder",
    body: water
      ? "Take a moment for a drink of water."
      : request.trim().slice(0, 180),
    quietHours: true,
  });
}
export function reminderSummary(
  d: Pick<ReminderDraft, "hour" | "minute" | "quietHours" | "intervalHours">,
) {
  return d.intervalHours
    ? `Every ${d.intervalHours} hour${d.intervalHours === 1 ? "" : "s"}`
    : `${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
}
