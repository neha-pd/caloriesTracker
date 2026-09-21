import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as adapter from "./adapter";
import { useTracker } from "../tracker";
import { useAuthStore } from "../../store/authStore";
import { onSessionExpired } from "../../lib/session";
import { localDateKey } from "../../lib/dates";
import type { HealthDay } from "./domain";
type State = {
  uid: string | null;
  enabled: boolean;
  since: string | null;
  lastSync: string | null;
  steps: number | null;
  activeCalories: number | null;
  days: Record<string, HealthDay>;
  permissionVersion: number;
  busy: boolean;
  importing: boolean;
  importProgress: number;
  error: string | null;
  initialize: (uid: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
  readDay: (date: string) => Promise<void>;
  importHistory: (older?: boolean) => Promise<void>;
};
const initial = {
  uid: null,
  enabled: false,
  since: null,
  lastSync: null,
  steps: null,
  activeCalories: null,
  days: {},
  permissionVersion: 0,
  busy: false,
  importing: false,
  importProgress: 0,
  error: null,
};
let running = false,
  storage: Promise<unknown> = Promise.resolve();
const reads = new Map<string, Promise<void>>();
function persist() {
  const s = useHealth.getState();
  if (!s.uid) return Promise.resolve();
  const key = "fitlens:health:" + s.uid;
  const value = JSON.stringify({
    enabled: s.enabled,
    since: s.since,
    lastSync: s.lastSync,
    days: s.days,
    permissionVersion: s.permissionVersion,
  });
  storage = storage
    .catch(() => {})
    .then(() => AsyncStorage.setItem(key, value));
  return storage;
}
export const useHealth = create<State>((set, get) => ({
  ...initial,
  initialize: async (uid) => {
    if (get().uid === uid) return;
    set({ ...initial, uid });
    const raw = await AsyncStorage.getItem("fitlens:health:" + uid);
    if (get().uid !== uid) return;
    if (raw)
      try {
        const c = JSON.parse(raw);
        set({
          enabled: c.enabled === true,
          since: c.since || null,
          lastSync: c.lastSync || null,
          days: c.days || {},
          permissionVersion: c.permissionVersion || 0,
        });
      } catch {}
  },
  connect: async () => {
    const uid = useAuthStore.getState().user?.id;
    if (!uid) return;
    if (uid === "fitlens-offline-demo") {
      set({
        error:
          "Health sync is disabled for sample data. Sign in to a real account to connect.",
      });
      return;
    }
    if (get().uid !== uid) await get().initialize(uid);
    set({ busy: true, error: null });
    try {
      await adapter.authorize();
      if (get().uid !== uid || useAuthStore.getState().user?.id !== uid) return;
      set({
        enabled: true,
        since: get().since || new Date().toISOString(),
        permissionVersion: 2,
      });
      await persist();
    } catch (e) {
      if (get().uid === uid)
        set({
          error: e instanceof Error ? e.message : "Could not connect health.",
        });
    } finally {
      if (get().uid === uid) set({ busy: false });
    }
    if (get().uid === uid && get().enabled) await get().sync();
  },
  disconnect: async () => {
    set({ enabled: false, steps: null, activeCalories: null, error: null });
    await persist();
  },
  readDay: async (date) => {
    const { uid, enabled } = get();
    if (!uid || !enabled || Platform.OS === "web") return;
    const key = uid + ":" + date;
    if (reads.has(key)) return reads.get(key)!;
    const task = (async () => {
      try {
        const day = await adapter.activity(date);
        if (get().uid !== uid || !get().enabled) return;
        set((s) => ({
          days: { ...s.days, [date]: day },
          lastSync: day.readAt,
          ...(date === localDateKey()
            ? { steps: day.steps, activeCalories: day.activeCalories }
            : {}),
        }));
        await persist();
      } catch (e) {
        if (get().uid === uid)
          set({
            error:
              e instanceof Error ? e.message : "Activity could not be read.",
          });
      }
    })().finally(() => reads.delete(key));
    reads.set(key, task);
    return task;
  },
  importHistory: async (older = false) => {
    const { uid, enabled } = get();
    if (!uid || !enabled || get().importing) return;
    set({ importing: true, importProgress: 0, error: null });
    try {
      if (older) await adapter.authorizeHistory();
      const count = older ? 365 : 30;
      for (let i = 0; i < count; i++) {
        if (get().uid !== uid || !get().enabled) break;
        const d = new Date();
        d.setDate(d.getDate() - i);
        await get().readDay(localDateKey(d));
        if (get().uid !== uid) break;
        set({ importProgress: Math.round(((i + 1) / count) * 100) });
      }
    } catch (e) {
      if (get().uid === uid)
        set({
          error:
            e instanceof Error ? e.message : "History access is unavailable.",
        });
    } finally {
      if (get().uid === uid) set({ importing: false });
    }
  },
  sync: async () => {
    const { uid, enabled, since } = get();
    if (!uid || !enabled || !since || running || Platform.OS === "web") return;
    running = true;
    set({ busy: true, error: null });
    try {
      // Reads happen independently: a denied nutrition write must never hide burn.
      await get().readDay(localDateKey());
      const tracker = useTracker.getState();
      if (tracker.uid !== uid || get().uid !== uid || !get().enabled) return;
      if (tracker.date !== localDateKey()) await get().readDay(tracker.date);
      if (tracker.queue.length) return;
      const raw = await AsyncStorage.getItem("fitlens:health-records:" + uid),
        sent: Record<string, string> = raw ? JSON.parse(raw) : {};
      for (const record of [...tracker.entries, ...tracker.water].filter(
        (e) => e.created_at >= since,
      )) {
        if (get().uid !== uid || !get().enabled) return;
        if (sent[record.id] === record.updated_at) continue;
        try {
          if ("calories" in record) await adapter.writeEntry(record, uid);
          else await adapter.writeWater(record, uid);
          sent[record.id] = record.updated_at;
          await AsyncStorage.setItem(
            "fitlens:health-records:" + uid,
            JSON.stringify(sent),
          );
        } catch {
          if (get().uid === uid)
            set({
              error:
                "Activity was read. Food/water export needs write permission; review health access.",
            });
          break;
        }
      }
    } catch (e) {
      if (get().uid === uid)
        set({
          error:
            e instanceof Error ? e.message : "Health sync needs attention.",
        });
    } finally {
      running = false;
      if (get().uid === uid) set({ busy: false });
    }
  },
}));
onSessionExpired(() => useHealth.setState({ ...initial }));

export async function removeLocalHealth(uid: string) {
  if (useHealth.getState().uid === uid) await useHealth.getState().disconnect();
  await storage.catch(() => {});
  await AsyncStorage.multiRemove([
    "fitlens:health:" + uid,
    "fitlens:health-records:" + uid,
  ]);
  if (useHealth.getState().uid === uid) useHealth.setState({ days: {} });
}
