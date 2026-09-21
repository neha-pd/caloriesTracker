import {
  dayRange,
  emptyHealthDay,
  finiteMetric,
  workoutMinutes,
} from "./domain";
import { localDateKey } from "../../lib/dates";
import * as HK from "@kingstinct/react-native-healthkit";
import { Linking } from "react-native";
import type { Entry, Water } from "../types";
const energy = "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  protein = "HKQuantityTypeIdentifierDietaryProtein",
  carbs = "HKQuantityTypeIdentifierDietaryCarbohydrates",
  fat = "HKQuantityTypeIdentifierDietaryFatTotal",
  water = "HKQuantityTypeIdentifierDietaryWater";
const writeTypes = [energy, protein, carbs, fat, water] as const;
export async function authorize() {
  if (!HK.isHealthDataAvailable())
    throw new Error("Apple Health is not available on this device.");
  if (
    !(await HK.requestAuthorization({
      toRead: [
        "HKQuantityTypeIdentifierStepCount",
        "HKQuantityTypeIdentifierActiveEnergyBurned",
        "HKQuantityTypeIdentifierBasalEnergyBurned",
        "HKWorkoutTypeIdentifier",
      ],
      toShare: [...writeTypes],
    }))
  )
    throw new Error("Health authorization was not completed.");
}
export async function authorizeHistory() {
  await authorize();
}
export async function activity(date = localDateKey()) {
  const { start: startDate, end: endDate } = dayRange(date),
    filter = { date: { startDate, endDate } },
    day = emptyHealthDay(date, "Apple Health");
  const metrics = [
    ["steps", "HKQuantityTypeIdentifierStepCount", "count"],
    ["activeCalories", "HKQuantityTypeIdentifierActiveEnergyBurned", "kcal"],
    ["restingCalories", "HKQuantityTypeIdentifierBasalEnergyBurned", "kcal"],
  ] as const;
  const values: Record<
    string,
    Awaited<ReturnType<typeof HK.queryStatisticsForQuantitySeparateBySource>>
  > = {};
  await Promise.all(
    metrics.map(async ([key, type, unit]) => {
      try {
        values[key] = await HK.queryStatisticsForQuantitySeparateBySource(
          type,
          ["cumulativeSum"],
          { filter, unit },
        );
        day.permissions[key] = values[key].length
          ? "available"
          : "no data or read access";
      } catch {
        day.permissions[key] = "unavailable";
        day.errors.push(key + " could not be read.");
      }
    }),
  );
  // Never sum overlapping applications. Use one source and disclose it.
  const choose = (items: (typeof values)[string] = []) =>
    [...items]
      .filter((x) => finiteMetric(x.sumQuantity?.quantity) != null)
      .sort(
        (a, b) =>
          (b.sumQuantity?.quantity || 0) - (a.sumQuantity?.quantity || 0),
      )[0];
  const steps = choose(values.steps),
    active = choose(values.activeCalories);
  const basal = active
    ? values.restingCalories?.find(
        (x) => x.source.bundleIdentifier === active.source.bundleIdentifier,
      )
    : choose(values.restingCalories);
  day.steps = finiteMetric(steps?.sumQuantity?.quantity);
  day.activeCalories = finiteMetric(active?.sumQuantity?.quantity);
  day.restingCalories = finiteMetric(basal?.sumQuantity?.quantity);
  if (
    active &&
    basal &&
    day.activeCalories != null &&
    day.restingCalories != null
  )
    day.totalCalories = day.activeCalories + day.restingCalories;
  if (active) day.source = "Apple Health · " + active.source.name;
  day.origins = [
    ...new Set(
      [steps, active, basal]
        .filter(Boolean)
        .map((x) => x!.source.bundleIdentifier),
    ),
  ];
  if ((values.activeCalories?.length || 0) > 1)
    day.errors.push(
      "Multiple energy sources: using the source with the largest active-energy reading, without adding overlapping sources.",
    );
  try {
    const workouts = await HK.queryWorkoutSamples({
      filter,
      limit: 500,
      ascending: false,
    });
    day.workouts = workouts.map((w) => ({
      id: w.uuid,
      name: String(
        HK.WorkoutActivityType[w.workoutActivityType] || "Workout",
      ).replace(/([a-z])([A-Z])/g, "$1 $2"),
      start: w.startDate.toISOString(),
      end: w.endDate.toISOString(),
      minutes: (w.endDate.getTime() - w.startDate.getTime()) / 60000,
      source: w.sourceRevision.source.name,
    }));
    day.exerciseMinutes = day.workouts.length
      ? workoutMinutes(day.workouts, date)
      : null;
    day.permissions.workouts = day.workouts.length
      ? "available"
      : "no data or read access";
    if (workouts.length === 500)
      day.errors.push("Workout list may be incomplete.");
  } catch {
    day.permissions.workouts = "unavailable";
    day.errors.push("Workouts could not be read.");
  }
  return day;
}
function time(e: { log_date: string; created_at: string }) {
  const c = new Date(e.created_at),
    d = new Date(e.log_date + "T12:00:00");
  return c.toLocaleDateString() === d.toLocaleDateString() ? c : d;
}
async function write(
  type: (typeof writeTypes)[number],
  unit: "g" | "kcal" | "mL",
  value: number,
  e: Entry | Water,
  uid: string,
) {
  const id = `fitlens:${uid}:${e.id}:${type}`;
  if (e.deleted_at) {
    await HK.deleteObjects(type, {
      metadata: { withMetadataKey: "HKMetadataKeySyncIdentifier", value: id },
    });
    return;
  }
  await HK.saveQuantitySample(type, unit, value, time(e), time(e), {
    HKMetadataKeySyncIdentifier: id,
    HKMetadataKeySyncVersion: "version" in e ? e.version : 1,
    HKWasUserEntered: true,
  });
}
export async function writeEntry(e: Entry, uid: string) {
  await write(energy, "kcal", e.calories, e, uid);
  await write(protein, "g", e.protein_g, e, uid);
  await write(carbs, "g", e.carbs_g, e, uid);
  await write(fat, "g", e.fat_g, e, uid);
}
export async function writeWater(e: Water, uid: string) {
  await write(water, "mL", e.amount_ml, e, uid);
}
export async function settings() {
  await Linking.openSettings();
}
