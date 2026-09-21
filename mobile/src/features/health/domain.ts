import { localDateKey } from "../../lib/dates";
export type HealthWorkout = {
  id: string;
  name: string;
  start: string;
  end: string;
  minutes: number;
  source: string;
};
export type HealthDay = {
  date: string;
  timezone?: string;
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  restingCalories: number | null;
  exerciseMinutes: number | null;
  workouts: HealthWorkout[];
  source: string;
  origins: string[];
  readAt: string;
  permissions: Record<string, string>;
  errors: string[];
};
export function dayRange(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid day.");
  const start = new Date(date + "T00:00:00");
  if (!Number.isFinite(start.getTime()) || localDateKey(start) !== date)
    throw new Error("Choose a valid day.");
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  const end = new Date(Math.min(next.getTime(), now.getTime()));
  if (end <= start)
    throw new Error("Activity is available for today and earlier days.");
  return { start, end };
}
export function finiteMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
export function workoutMinutes(
  workouts: HealthWorkout[],
  date: string,
  now = new Date(),
) {
  const { start, end } = dayRange(date, now),
    ranges = workouts
      .map((w) => [
        Math.max(start.getTime(), new Date(w.start).getTime()),
        Math.min(end.getTime(), new Date(w.end).getTime()),
      ])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
      .sort((a, b) => a[0] - b[0]);
  let total = 0,
    until = -Infinity;
  for (const [a, b] of ranges) {
    total += Math.max(0, b - Math.max(a, until));
    until = Math.max(until, b);
  }
  return total / 60000;
}
export function restingFromSameSource(
  total: number | null,
  active: number | null,
  totalOrigins: string[],
  activeOrigins: string[],
) {
  const same =
    totalOrigins.length > 0 &&
    totalOrigins.length === activeOrigins.length &&
    totalOrigins.every((x) => activeOrigins.includes(x));
  return same && total != null && active != null && total >= active
    ? total - active
    : null;
}
export function emptyHealthDay(date: string, source: string): HealthDay {
  return {
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    steps: null,
    activeCalories: null,
    totalCalories: null,
    restingCalories: null,
    exerciseMinutes: null,
    workouts: [],
    source,
    origins: [],
    readAt: new Date().toISOString(),
    permissions: {},
    errors: [],
  };
}
