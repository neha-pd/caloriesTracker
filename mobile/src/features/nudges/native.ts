import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
let suspended = false;
let operations: Promise<unknown> = Promise.resolve();
export function configureNudgeNative(raw: string) {
  operations = operations
    .catch(() => {})
    .then(() => (suspended ? undefined : nudgeNative()?.configure(raw)));
  return operations;
}
export const nudgeNative = () =>
  Platform.OS === "android"
    ? requireOptionalNativeModule("FitLensNudges")
    : null;
export function pauseNudgesSession() {
  suspended = true;
  operations = operations
    .catch(() => {})
    .then(() => nudgeNative()?.stop())
    .catch(() => {});
}
export function resumeNudgesSession() {
  suspended = false;
}
export const nudgesSuspended = () => suspended;
