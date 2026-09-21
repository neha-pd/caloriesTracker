import {
  dayRange,
  emptyHealthDay,
  finiteMetric,
  workoutMinutes,
  restingFromSameSource,
} from "./domain";
import { localDateKey } from "../../lib/dates";
import * as HC from "react-native-health-connect";
import type { Entry, Water } from "../types";
const permissions = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "TotalCaloriesBurned" },
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "write", recordType: "Nutrition" },
  { accessType: "write", recordType: "Hydration" },
] as const;
export async function authorize() {
  if (!(await HC.initialize()))
    throw new Error(
      "Health Connect is unavailable. Install or update it in Android settings.",
    );
  const granted = await HC.requestPermission([...permissions]);
  if (!granted.length)
    throw new Error(
      "No health permissions were granted. You can try again in Health Connect.",
    );
}
export async function authorizeHistory() {
  const granted = await HC.requestPermission([
    { accessType: "read", recordType: "ReadHealthDataHistory" },
  ]);
  if (!granted.some((p) => p.recordType === "ReadHealthDataHistory"))
    throw new Error(
      "Older history was not allowed or is unsupported on this phone. Recent activity can still sync.",
    );
}
export async function activity(date = localDateKey()) {
  if (!(await HC.initialize()))
    throw new Error("Health Connect is unavailable.");
  const { start, end } = dayRange(date),
    day = emptyHealthDay(date, "Health Connect");
  const timeRangeFilter = {
    operator: "between" as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
  const granted = await HC.getGrantedPermissions();
  const has = (recordType: string) =>
    granted.some((p) => p.recordType === recordType && p.accessType === "read");
  const origins: Record<string, string[]> = {};
  await Promise.all(
    (["Steps", "ActiveCaloriesBurned", "TotalCaloriesBurned"] as const).map(
      async (type) => {
        day.permissions[type] = has(type) ? "allowed" : "not allowed";
        if (!has(type)) return;
        try {
          const result = await HC.aggregateRecord({
            recordType: type,
            timeRangeFilter,
          });
          origins[type] = result.dataOrigins || [];
          day.origins.push(...origins[type]);
          if (!origins[type].length) {
            day.permissions[type] = "no records";
            return;
          }
          if ("COUNT_TOTAL" in result)
            day.steps = finiteMetric(result.COUNT_TOTAL);
          else if ("ACTIVE_CALORIES_TOTAL" in result)
            day.activeCalories = finiteMetric(
              (result.ACTIVE_CALORIES_TOTAL as { inKilocalories?: number })
                ?.inKilocalories,
            );
          else if ("ENERGY_TOTAL" in result)
            day.totalCalories = finiteMetric(
              (result.ENERGY_TOTAL as { inKilocalories?: number })
                ?.inKilocalories,
            );
        } catch {
          day.permissions[type] = "unavailable";
          day.errors.push(
            type + " could not be read. Review access and sync your watch app.",
          );
        }
      },
    ),
  );
  day.permissions.ExerciseSession = has("ExerciseSession")
    ? "allowed"
    : "not allowed";
  if (has("ExerciseSession"))
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < 10; page++) {
        const result = await HC.readRecords("ExerciseSession", {
          timeRangeFilter,
          pageSize: 500,
          pageToken,
        });
        day.workouts.push(
          ...result.records.map((w) => ({
            id:
              w.metadata?.id ||
              [
                w.metadata?.dataOrigin,
                w.startTime,
                w.endTime,
                w.exerciseType,
              ].join(":"),
            name: w.title || "Recorded workout",
            start: w.startTime,
            end: w.endTime,
            minutes:
              (new Date(w.endTime).getTime() -
                new Date(w.startTime).getTime()) /
              60000,
            source: w.metadata?.dataOrigin || "Health Connect",
          })),
        );
        pageToken = result.pageToken;
        if (!pageToken) break;
        if (page === 9)
          day.errors.push(
            "Workout list is incomplete; there are too many records.",
          );
      }
      day.workouts = day.workouts.filter(
        (w, i, all) => all.findIndex((x) => x.id === w.id) === i,
      );
      const duration = await HC.aggregateRecord({
        recordType: "ExerciseSession",
        timeRangeFilter,
      });
      day.exerciseMinutes =
        duration.dataOrigins?.length &&
        finiteMetric(duration.EXERCISE_DURATION_TOTAL?.inSeconds) != null
          ? duration.EXERCISE_DURATION_TOTAL.inSeconds / 60
          : null;
      if (!day.workouts.length) day.permissions.ExerciseSession = "no records";
    } catch {
      day.permissions.ExerciseSession = "unavailable";
      day.errors.push("Workouts could not be read.");
    }
  day.restingCalories = restingFromSameSource(
    day.totalCalories,
    day.activeCalories,
    origins.TotalCaloriesBurned || [],
    origins.ActiveCaloriesBurned || [],
  );
  day.origins = [...new Set(day.origins)];
  return day;
}
function timing(e: Entry | Water) {
  const c = new Date(e.created_at),
    d = new Date(e.log_date + "T12:00:00");
  const t = c.toLocaleDateString() === d.toLocaleDateString() ? c : d;
  return {
    startTime: t.toISOString(),
    endTime: new Date(t.getTime() + 1000).toISOString(),
  };
}
export async function writeEntry(e: Entry, uid: string) {
  const clientRecordId = `fitlens:${uid}:${e.id}`;
  if (e.deleted_at) {
    await HC.deleteRecordsByUuids("Nutrition", [], [clientRecordId]);
    return;
  }
  await HC.insertRecords([
    {
      recordType: "Nutrition",
      ...timing(e),
      name: e.name,
      mealType: { breakfast: 1, lunch: 2, dinner: 3, snack: 4 }[e.meal_type],
      energy: { unit: "kilocalories", value: e.calories },
      protein: { unit: "grams", value: e.protein_g },
      totalCarbohydrate: { unit: "grams", value: e.carbs_g },
      totalFat: { unit: "grams", value: e.fat_g },
      metadata: {
        clientRecordId,
        clientRecordVersion: e.version,
        recordingMethod: 3,
      },
    },
  ]);
}
export async function writeWater(e: Water, uid: string) {
  const clientRecordId = `fitlens:${uid}:${e.id}`;
  if (e.deleted_at) {
    await HC.deleteRecordsByUuids("Hydration", [], [clientRecordId]);
    return;
  }
  await HC.insertRecords([
    {
      recordType: "Hydration",
      ...timing(e),
      volume: { unit: "liters", value: e.amount_ml / 1000 },
      metadata: { clientRecordId, clientRecordVersion: 1, recordingMethod: 3 },
    },
  ]);
}
export async function settings() {
  HC.openHealthConnectSettings();
}
