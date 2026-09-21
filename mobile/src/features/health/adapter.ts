import { emptyHealthDay, type HealthDay } from "./domain";
import { localDateKey } from "../../lib/dates";
import type { Entry, Water } from "../types";
export async function authorize() {
  throw new Error(
    "Health sync is available in the native iPhone and Android app.",
  );
}
export async function authorizeHistory() {
  throw new Error("Health history requires the phone app.");
}
export async function activity(date = localDateKey()): Promise<HealthDay> {
  return emptyHealthDay(date, "Unavailable in browser");
}
export async function writeEntry(_e: Entry, _uid: string): Promise<void> {}
export async function writeWater(_e: Water, _uid: string): Promise<void> {}
export async function settings(): Promise<void> {}
export function recordTime(e: { log_date: string; created_at: string }) {
  const created = new Date(e.created_at);
  const date = new Date(e.log_date + "T12:00:00");
  if (created.toLocaleDateString() === date.toLocaleDateString())
    return created;
  return date;
}
