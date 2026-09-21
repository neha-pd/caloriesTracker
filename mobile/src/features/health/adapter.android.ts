import * as HC from "react-native-health-connect";
import type { Entry, Water } from "../types";
const permissions = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
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
export async function activity() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const timeRangeFilter = {
    operator: "between" as const,
    startTime: d.toISOString(),
    endTime: new Date().toISOString(),
  };
  const granted = await HC.getGrantedPermissions();
  const has = (recordType: string) =>
    granted.some((p) => p.recordType === recordType && p.accessType === "read");
  const steps = has("Steps")
    ? await HC.aggregateRecord({ recordType: "Steps", timeRangeFilter })
    : null;
  const cal = has("ActiveCaloriesBurned")
    ? await HC.aggregateRecord({
        recordType: "ActiveCaloriesBurned",
        timeRangeFilter,
      })
    : null;
  return {
    steps: steps?.COUNT_TOTAL ?? null,
    activeCalories: cal?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? null,
  };
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
