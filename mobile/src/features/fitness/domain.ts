import type { Entry, FitnessRecord, Workout } from "../types";
import type { HealthDay } from "../health/domain";
import { localDateKey } from "../../lib/dates";
export function energyForDay(
  date: string,
  records: FitnessRecord[],
  day?: HealthDay,
) {
  const workouts = records.filter(
    (r): r is Workout =>
      r.kind === "workout" && !r.deleted_at && r.log_date === date,
  );
  const hasWatch = day?.activeCalories != null || day?.totalCalories != null;
  const counted = workouts.filter(
    (w) =>
      w.energyPolicy === "additional" ||
      (w.energyPolicy === "auto" && !hasWatch),
  );
  const known = counted.filter((w) => w.calories != null);
  const extra = known.reduce((n, w) => n + w.calories!, 0);
  const active =
    day?.activeCalories != null
      ? day.activeCalories + extra
      : known.length
        ? extra
        : null;
  // A manually logged workout never establishes resting energy or total daily burn.
  const total = day?.totalCalories != null ? day.totalCalories + extra : null;
  const timed = workouts.filter(
    (w) =>
      w.energyPolicy === "additional" ||
      (w.energyPolicy === "auto" && day?.exerciseMinutes == null),
  );
  const ranges = timed
    .map((w) => [Date.parse(w.start), Date.parse(w.start) + w.minutes * 60000])
    .sort((a, b) => a[0] - b[0]);
  let until = -Infinity,
    manualMinutes = 0;
  for (const [start, end] of ranges) {
    manualMinutes += Math.max(0, end - Math.max(start, until)) / 60000;
    until = Math.max(until, end);
  }
  return {
    activeCalories: active,
    totalCalories: total,
    exerciseMinutes:
      day?.exerciseMinutes != null
        ? day.exerciseMinutes + manualMinutes
        : timed.length
          ? manualMinutes
          : null,
    workouts,
    extraCalories: extra,
    partial: counted.some((w) => w.calories == null),
  };
}
export function periodDates(anchor: string, period: "day" | "month" | "year") {
  const [y, m, d] = anchor.split("-").map(Number),
    start = new Date(
      y,
      period === "year" ? 0 : m - 1,
      period === "day" ? d : 1,
      12,
    ),
    end = new Date(
      y,
      period === "year" ? 12 : period === "month" ? m : m - 1,
      period === "day" ? d + 1 : 1,
      12,
    );
  const result: string[] = [];
  for (
    const cursor = new Date(start);
    cursor < end;
    cursor.setDate(cursor.getDate() + 1)
  )
    result.push(localDateKey(cursor));
  return result;
}
export function summarize(
  dates: string[],
  entries: Entry[],
  records: FitnessRecord[],
  days: Record<string, HealthDay>,
) {
  const rows = dates.map((date) => {
    const foods = entries.filter((e) => !e.deleted_at && e.log_date === date),
      energy = energyForDay(date, records, days[date]);
    return {
      date,
      foods: foods.length,
      eaten: foods.reduce((n, e) => n + e.calories, 0),
      ...energy,
    };
  });
  const foodDays = rows.filter((r) => r.foods > 0),
    burnDays = rows.filter((r) => r.totalCalories != null),
    activeDays = rows.filter((r) => r.activeCalories != null);
  const weights = records
    .filter(
      (r): r is Extract<FitnessRecord, { kind: "weight" }> =>
        r.kind === "weight" && !r.deleted_at && dates.includes(r.log_date),
    )
    .sort((a, b) => a.log_date.localeCompare(b.log_date));
  return {
    rows,
    foodDays: foodDays.length,
    burnDays: burnDays.length,
    activeDays: activeDays.length,
    eaten: foodDays.reduce((n, r) => n + r.eaten, 0),
    totalBurn: burnDays.reduce((n, r) => n + r.totalCalories!, 0),
    activeBurn: activeDays.reduce((n, r) => n + r.activeCalories!, 0),
    minutes: rows.reduce((n, r) => n + (r.exerciseMinutes ?? 0), 0),
    workoutCount: rows.reduce(
      (n, r) => n + r.workouts.length + (days[r.date]?.workouts.length || 0),
      0,
    ),
    weightChange:
      weights.length >= 2 && weights[0].log_date !== weights.at(-1)!.log_date
        ? weights.at(-1)!.weightKg - weights[0].weightKg
        : null,
    weights,
  };
}
