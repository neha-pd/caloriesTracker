/**
 * Calendar-day helpers. A day is identified by the device's LOCAL date as a
 * 'YYYY-MM-DD' key — never by a timestamp, and never via toISOString(), which
 * converts to UTC and shifts the day for anyone not on UTC.
 */

/** Local calendar date key for `date` (default: now). */
export function localDateKey(date: Date = new Date()): string {
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Parse a day key into a local-midnight Date. Accepts 'YYYY-MM-DD' and, for
 * older API responses, full ISO strings whose leading date is the day key.
 * Returns null for anything unparseable instead of an Invalid Date.
 */
export function parseDateKey(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Normalised 'YYYY-MM-DD' for a day key (or ISO string), or null. */
export function toDateKey(value: unknown): string | null {
  const date = parseDateKey(value);
  return date ? localDateKey(date) : null;
}
