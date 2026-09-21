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
      ],
      toShare: [...writeTypes],
    }))
  )
    throw new Error("Health authorization was not completed.");
}
export async function activity() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const filter = { date: { startDate, endDate: new Date() } };
  const [steps, cal] = await Promise.all([
    HK.queryStatisticsForQuantity(
      "HKQuantityTypeIdentifierStepCount",
      ["cumulativeSum"],
      { filter, unit: "count" },
    ),
    HK.queryStatisticsForQuantity(
      "HKQuantityTypeIdentifierActiveEnergyBurned",
      ["cumulativeSum"],
      { filter, unit: "kcal" },
    ),
  ]);
  return {
    steps: steps.sumQuantity?.quantity ?? null,
    activeCalories: cal.sumQuantity?.quantity ?? null,
  };
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
