import {
  validateReminder,
  reminderTimes,
  type ReminderDraft,
} from "./reminderDomain";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const local = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
function stable(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
export function reminderCalendar(drafts: ReminderDraft[], now = new Date()) {
  if (!drafts.length || drafts.length > 8)
    throw Error("Choose between 1 and 8 reminders.");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fitkin//Habits//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const [index, raw] of drafts.entries()) {
    const d = validateReminder(raw),
      days =
        d.cadence === "weekdays"
          ? [1, 2, 3, 4, 5]
          : d.cadence === "weekends"
            ? [0, 6]
            : [0, 1, 2, 3, 4, 5, 6];
    for (const t of reminderTimes(d)) {
      const start = new Date(now);
      start.setHours(t.hour, t.minute, 0, 0);
      while (start <= now || !days.includes(start.getDay()))
        start.setDate(start.getDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:fitkin-${stable(JSON.stringify(d))}-${index}-${t.hour}-${t.minute}@fitkin`,
        "DTSTAMP:" +
          now
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d+Z/, "Z"),
        "DTSTART:" + local(start),
        "DTEND:" + local(new Date(+start + 5 * 60000)),
        "RRULE:FREQ=WEEKLY;BYDAY=" +
          days
            .map((day) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day])
            .join(","),
        "SUMMARY:" + escape(d.title),
        "DESCRIPTION:" + escape(d.body),
        "BEGIN:VALARM",
        "TRIGGER:PT0S",
        "ACTION:DISPLAY",
        "DESCRIPTION:" + escape(d.title),
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  // Fold at 75 UTF-8 octets, without splitting a Unicode character.
  return (
    lines
      .map((line) => {
        let out = "",
          part = "",
          bytes = 0;
        for (const ch of line) {
          const n = new TextEncoder().encode(ch).length;
          if (bytes + n > 75) {
            out += part + "\r\n";
            part = " ";
            bytes = 1;
          }
          part += ch;
          bytes += n;
        }
        return out + part;
      })
      .join("\r\n") + "\r\n"
  );
}
