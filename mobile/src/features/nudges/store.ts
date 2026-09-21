import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import { useHealth } from "../health/store";
import { localDateKey } from "../../lib/dates";
import { onSessionExpired } from "../../lib/session";
import {
  nudgeNative,
  configureNudgeNative,
  nudgesSuspended,
  resumeNudgesSession,
  pauseNudgesSession,
} from "./native";
import {
  defaultNudges,
  nudgeCopy,
  validateNudges,
  NudgeSettings,
} from "./domain";
import { energyForDay } from "../fitness/domain";
type State = {
  uid: string | null;
  settings: NudgeSettings;
  ready: boolean;
  initialize: (uid: string) => Promise<void>;
  save: (s: NudgeSettings) => Promise<void>;
};
let queue = Promise.resolve();
export const useNudges = create<State>((set, get) => ({
  uid: null,
  settings: defaultNudges,
  ready: false,
  initialize: async (uid) => {
    if (get().uid === uid) return;
    set({ uid, settings: defaultNudges, ready: false });
    const raw = await AsyncStorage.getItem("fitlens:nudges:" + uid);
    if (get().uid !== uid) return;
    let settings = defaultNudges;
    try {
      if (raw) settings = { ...defaultNudges, ...JSON.parse(raw) };
    } catch {}
    set({ settings, ready: true });
    resumeNudgesSession();
    await refreshNudgeContext();
  },
  save: async (value) => {
    const uid = get().uid;
    if (!uid || uid === "fitlens-offline-demo")
      throw Error("Sign in to enable personal nudges.");
    if (Platform.OS !== "android" || !nudgeNative())
      throw Error(
        "Smart background nudges require the updated Android app. Custom reminders remain available on iPhone.",
      );
    const clean = validateNudges(value);
    if (clean.enabled) {
      const N = await import("expo-notifications");
      await N.setNotificationChannelAsync("fitlens-smart", {
        name: "Ember smart nudges",
        importance: N.AndroidImportance.DEFAULT,
      });
      if (!(await N.requestPermissionsAsync()).granted)
        throw Error("Allow notifications in device settings to enable nudges.");
    }
    if (get().uid !== uid || useAuthStore.getState().user?.id !== uid)
      throw Error("Your session changed.");
    const settings = {
      ...clean,
      enabledAt:
        clean.enabled && (!get().settings.enabled || !get().settings.enabledAt)
          ? new Date().toISOString()
          : get().settings.enabledAt,
    };
    await AsyncStorage.setItem(
      "fitlens:nudges:" + uid,
      JSON.stringify(settings),
    );
    if (get().uid !== uid) return;
    set({ settings });
    if (settings.enabled) {
      // Smart checks replace the old static presets; user-written custom schedules remain separate.
      const raw = await AsyncStorage.getItem("fitlens:reminders:" + uid);
      const ids = raw ? (Object.values(JSON.parse(raw)) as string[]) : [];
      const N = await import("expo-notifications");
      await Promise.all(
        ids.map((id) => N.cancelScheduledNotificationAsync(id)),
      );
      await AsyncStorage.removeItem("fitlens:reminders:" + uid);
    }
    await refreshNudgeContext();
    if (settings.enabled) await nudgeNative()?.checkNow();
  },
}));
export function refreshNudgeContext() {
  const uid = useNudges.getState().uid;
  queue = queue
    .catch(() => {})
    .then(async () => {
      const s = useNudges.getState(),
        t = useTracker.getState(),
        u = useAuthStore.getState().user,
        h = useHealth.getState();
      if (
        nudgesSuspended() ||
        !s.ready ||
        !uid ||
        uid !== s.uid ||
        u?.id !== uid ||
        t.uid !== uid ||
        uid === "fitlens-offline-demo"
      )
        return;
      const days: Record<string, any> = {};
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const date = localDateKey(d),
          health = h.uid === uid ? h.days[date] : undefined,
          energy = energyForDay(date, t.fitness, health);
        days[date] = {
          meals: [
            ...new Set(
              t.entries
                .filter((e) => !e.deleted_at && e.log_date === date)
                .map((e) => e.meal_type),
            ),
          ],
          water: t.water
            .filter((w) => !w.deleted_at && w.log_date === date)
            .reduce((n, w) => n + w.amount_ml, 0),
          minutes: energy.exerciseMinutes || 0,
          steps: health?.steps ?? null,
          workouts: health?.workouts.slice(-200) || [],
          manual: energy.workouts.slice(-200).map((w) => ({
            start: w.start,
            minutes: w.minutes,
          })),
        };
      }
      await configureNudgeNative(
        JSON.stringify({
          uid,
          name: u.display_name?.split(" ")[0] || "friend",
          settings: s.settings,
          days,
          copy: nudgeCopy,
          waterGoal: u.settings.water_goal_ml || 2000,
          stepGoal: u.settings.step_goal || 0,
          healthEnabled: h.uid === uid && h.enabled,
        }),
      );
    });
  return queue;
}
onSessionExpired(() => {
  pauseNudgesSession();
  useNudges.setState({ uid: null, settings: defaultNudges, ready: false });
});
