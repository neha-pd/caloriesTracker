import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as adapter from "./adapter";
import { useTracker } from "../tracker";
import { useAuthStore } from "../../store/authStore";
import { onSessionExpired } from "../../lib/session";
type State = {
  uid: string | null;
  enabled: boolean;
  since: string | null;
  lastSync: string | null;
  steps: number | null;
  activeCalories: number | null;
  busy: boolean;
  error: string | null;
  initialize: (uid: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
};
let running = false;
export const useHealth = create<State>((set, get) => ({
  uid: null,
  enabled: false,
  since: null,
  lastSync: null,
  steps: null,
  activeCalories: null,
  busy: false,
  error: null,
  initialize: async (uid) => {
    if (get().uid === uid) return;
    set({
      uid,
      enabled: false,
      since: null,
      lastSync: null,
      steps: null,
      activeCalories: null,
      error: null,
    });
    const c = await AsyncStorage.getItem("fitlens:health:" + uid);
    if (get().uid !== uid) return;
    if (c) {
      try {
        set(JSON.parse(c));
      } catch {}
    }
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
    set({ busy: true, error: null });
    try {
      await adapter.authorize();
      if (useAuthStore.getState().user?.id !== uid) return;
      const since = get().since || new Date().toISOString();
      set({ enabled: true, since });
      await AsyncStorage.setItem(
        "fitlens:health:" + uid,
        JSON.stringify({ enabled: true, since, lastSync: get().lastSync }),
      );
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Could not connect health.",
      });
    } finally {
      set({ busy: false });
    }
    if (get().enabled) await get().sync();
  },
  disconnect: async () => {
    const uid = get().uid;
    set({ enabled: false, steps: null, activeCalories: null });
    if (uid)
      await AsyncStorage.setItem(
        "fitlens:health:" + uid,
        JSON.stringify({
          enabled: false,
          since: get().since,
          lastSync: get().lastSync,
        }),
      );
  },
  sync: async () => {
    const { uid, enabled, since } = get();
    if (!uid || !enabled || !since || running || Platform.OS === "web") return;
    running = true;
    set({ busy: true, error: null });
    try {
      const tracker = useTracker.getState();
      if (tracker.uid !== uid || tracker.queue.length) return;
      const raw = await AsyncStorage.getItem("fitlens:health-records:" + uid);
      const sent: Record<string, string> = raw ? JSON.parse(raw) : {};
      const records = [...tracker.entries, ...tracker.water].filter(
        (e) => e.created_at >= since,
      );
      for (const record of records) {
        if (get().uid !== uid || !get().enabled) return;
        if (sent[record.id] === record.updated_at) continue;
        if ("calories" in record) await adapter.writeEntry(record, uid);
        else await adapter.writeWater(record, uid);
        sent[record.id] = record.updated_at;
        await AsyncStorage.setItem(
          "fitlens:health-records:" + uid,
          JSON.stringify(sent),
        );
      }
      const values = await adapter.activity();
      if (get().uid !== uid) return;
      const lastSync = new Date().toISOString();
      set({ ...values, lastSync });
      await AsyncStorage.setItem(
        "fitlens:health:" + uid,
        JSON.stringify({ enabled: true, since, lastSync }),
      );
    } catch (e) {
      if (get().uid === uid)
        set({
          error:
            e instanceof Error
              ? e.message
              : "Health sync needs attention. Review your permissions.",
        });
    } finally {
      running = false;
      if (get().uid === uid) set({ busy: false });
    }
  },
}));
onSessionExpired(() =>
  useHealth.setState({
    uid: null,
    enabled: false,
    since: null,
    lastSync: null,
    steps: null,
    activeCalories: null,
    busy: false,
    error: null,
  }),
);
