import type { FastifyRequest } from 'fastify';

/**
 * Calendar-day handling. A "day" in FitLens is the user's LOCAL calendar date,
 * always represented as a 'YYYY-MM-DD' key — never a timestamp. The server
 * clock is UTC, so deriving "today" from `new Date().toISOString()` files
 * everything logged between local midnight and UTC midnight under the wrong
 * day (e.g. 00:10 IST lands on the previous date).
 */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Shift a date key by whole days (pure calendar arithmetic, no timezone). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Resolve the calendar day a request refers to:
 *   1. an explicit, valid `date` supplied by the caller (query/body),
 *   2. the client's local date from the `X-Local-Date` header,
 *   3. the UTC date, as a last resort for clients that send neither.
 */
export function resolveLogDate(request: FastifyRequest, explicit?: unknown): string {
  if (isDateKey(explicit)) return explicit;
  const header = request.headers['x-local-date'];
  const local = Array.isArray(header) ? header[0] : header;
  if (isDateKey(local)) return local;
  return new Date().toISOString().slice(0, 10);
}
