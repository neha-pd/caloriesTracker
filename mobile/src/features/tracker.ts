import { xpReward, withXp, xpStreak } from "./xp";
import { DEMO_ID } from "./demo/data";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import api, { errorMessage } from "../lib/api";
import { onSessionExpired } from "../lib/session";
import { localDateKey } from "../lib/dates";
import type {
  Entry,
  Water,
  Food,
  Meal,
  Progress,
  Nutrition,
  FitnessRecord,
} from "./types";
export type Operation = {
  method: "put" | "patch" | "delete" | "post";
  url: string;
  body?: any;
  optimisticXp?: number;
  xpKeys?: string[];
};
const emptyProgress: Progress = {
  xp: 0,
  level: 1,
  progress: 0,
  next: 250,
  streak: 0,
  dates: [],
  badges: [],
};
interface Tracker {
  uid: string | null;
  date: string;
  entries: Entry[];
  water: Water[];
  foods: Food[];
  fitness: FitnessRecord[];
  saveFitness: (record: FitnessRecord) => Promise<void>;
  deleteFitness: (id: string) => Promise<void>;
  queue: Operation[];
  progress: Progress;
  syncing: boolean;
  ready: boolean;
  error: string | null;
  notice: string | null;
  initialize: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  setDate: (date: string) => void;
  addFood: (
    food: Food,
    quantity: number,
    meal: Meal,
    source?: Entry["source"],
  ) => Promise<Entry>;
  editEntry: (id: string, quantity: number, meal: Meal) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  deleteWater: (id: string) => Promise<void>;
  saveFood: (food: Food) => Promise<void>;
  checkIn: () => Promise<void>;
}
let flight: Promise<void> | null = null;
let disk: Promise<void> = Promise.resolve();
function persist() {
  const s = useTracker.getState();
  if (!s.uid) return;
  const key = "fitlens:data:" + s.uid;
  const value = JSON.stringify({
    entries: s.entries,
    water: s.water,
    foods: s.foods,
    fitness: s.fitness,
    queue: s.queue,
    progress: s.progress,
  });
  disk = disk.catch(() => {}).then(() => AsyncStorage.setItem(key, value));
  return disk;
}
async function enqueue(op: Operation) {
  const state = useTracker.getState(),
    today = localDateKey();
  const keys =
    state.progress.today_events?.date === today
      ? state.progress.today_events.keys
      : [];
  const reward = xpReward(op, keys, today);
  op.optimisticXp = reward.amount;
  op.xpKeys = reward.keys;
  if (reward.amount)
    useTracker.setState({
      progress: {
        ...withXp(state.progress, reward.amount),
        today_events: { date: today, keys: [...keys, ...reward.keys] },
        dates: [...new Set([today, ...state.progress.dates])],
        streak: xpStreak([today, ...state.progress.dates], today),
      },
      notice: `+${reward.amount} XP · ${state.uid === DEMO_ID ? "Demo progress updated." : "Saved on this device; sync confirms your XP."}`,
    });
  if (useTracker.getState().uid === DEMO_ID) {
    await persist();
    return;
  }
  useTracker.setState((s) => ({ queue: [...s.queue, op] }));
  await persist();
  void useTracker.getState().sync();
}
const totals = (base: Nutrition, quantity: number): Nutrition => ({
  calories: base.calories * quantity,
  protein_g: base.protein_g * quantity,
  carbs_g: base.carbs_g * quantity,
  fat_g: base.fat_g * quantity,
  fiber_g: base.fiber_g == null ? null : base.fiber_g * quantity,
});
export const useTracker = create<Tracker>((set, get) => ({
  uid: null,
  date: localDateKey(),
  entries: [],
  water: [],
  foods: [],
  fitness: [],
  queue: [],
  progress: emptyProgress,
  syncing: false,
  ready: false,
  error: null,
  notice: null,
  initialize: async (uid) => {
    if (get().uid === uid) return;
    set({
      uid,
      entries: [],
      water: [],
      foods: [],
      fitness: [],
      queue: [],
      progress: emptyProgress,
      ready: false,
      error: null,
    });
    const cached = await AsyncStorage.getItem("fitlens:data:" + uid);
    if (get().uid !== uid) return;
    if (cached) {
      try {
        set({ ...JSON.parse(cached), ready: true });
      } catch {
        set({ ready: true });
      }
    } else set({ ready: true });
    if (
      uid === DEMO_ID &&
      get().progress.today_events?.date !== localDateKey()
    ) {
      const today = localDateKey(),
        p = get().progress;
      const keys = [
        ...new Set(
          get()
            .entries.filter((e) => e.log_date === today)
            .map((e) => "meal:" + e.meal_type),
        ),
      ];
      if (get().water.some((w) => w.log_date === today)) keys.push("hydration");
      if (p.dates.includes(today)) keys.push("check-in");
      set({ progress: { ...p, today_events: { date: today, keys } } });
    }
    await get().sync();
  },
  setDate: (date) => set({ date }),
  sync: async () => {
    if (flight) {
      await flight;
      if (get().uid && get().queue.length) return get().sync();
      return;
    }
    const uid = get().uid;
    if (!uid) return;
    if (uid === DEMO_ID) {
      set({ queue: [], syncing: false, error: null });
      await persist();
      return;
    }
    flight = (async () => {
      set({ syncing: true, error: null });
      try {
        while (get().uid === uid && get().queue.length) {
          const op = get().queue[0];
          try {
            const { data } = await api.request({
              method: op.method,
              url: op.url,
              data: op.body,
            });
            if (get().uid !== uid) return;
            if (
              data.entry &&
              !get()
                .queue.slice(1)
                .some((o) => o.url === op.url)
            )
              set((s) => ({
                entries: s.entries.map((e) =>
                  e.id === data.entry.id ? data.entry : e,
                ),
              }));
            if (
              data.record &&
              !get()
                .queue.slice(1)
                .some((o) => o.url === op.url)
            )
              set((s) => ({
                fitness: s.fitness.map((r) =>
                  r.id === data.record.id ? data.record : r,
                ),
              }));
            if (op.optimisticXp || data.awarded_xp)
              set((s) => ({
                progress: withXp(
                  s.progress,
                  Number(data.awarded_xp || 0) - Number(op.optimisticXp || 0),
                ),
              }));
            if (data.awarded_xp)
              set({
                notice: `+${data.awarded_xp} XP · A little win for showing up.`,
              });
          } catch (e: any) {
            if ([400, 404, 409].includes(e?.response?.status)) {
              if (op.optimisticXp)
                set((s) => ({
                  progress: {
                    ...withXp(s.progress, -op.optimisticXp!),
                    today_events: s.progress.today_events
                      ? {
                          ...s.progress.today_events,
                          keys: s.progress.today_events.keys.filter(
                            (k) => !op.xpKeys?.includes(k),
                          ),
                        }
                      : undefined,
                  },
                }));
              set({
                notice:
                  e?.response?.status === 409
                    ? "An entry changed on another device. Its latest version has been restored."
                    : "An entry could not be accepted: " + errorMessage(e),
              });
            } else throw e;
          }
          if (get().uid !== uid) return;
          set((s) => ({ queue: s.queue.slice(1) }));
          await persist();
        }
        const [changes, progress, custom, fitness] = await Promise.all([
          api.get("/api/v2/changes"),
          api.get("/api/v2/progress"),
          api.get("/api/v2/foods/custom"),
          api.get("/api/v2/fitness"),
        ]);
        if (get().uid !== uid) return;
        // Preserve mutations queued during the pull; the next sync reconciles them.
        if (get().queue.length === 0)
          set({
            entries: changes.data.entries,
            fitness: fitness.data.records,
            water: changes.data.water,
            foods: custom.data.foods.map((f: any) => ({
              ...f,
              source: "custom",
              calories: Number(f.calories),
              protein_g: Number(f.protein_g),
              carbs_g: Number(f.carbs_g),
              fat_g: Number(f.fat_g),
              serving_qty: Number(f.serving_qty),
            })),
          });
        const pending = get().queue;
        set({
          progress: {
            ...withXp(
              progress.data,
              pending.reduce((n, o) => n + (o.optimisticXp || 0), 0),
            ),
            today_events: {
              date: progress.data.today_events?.date || localDateKey(),
              keys: [
                ...(progress.data.today_events?.keys || []),
                ...pending.flatMap((o) => o.xpKeys || []),
              ],
            },
          },
        });
        await persist();
      } catch (e) {
        if (get().uid === uid) set({ error: errorMessage(e) });
      } finally {
        if (get().uid === uid) set({ syncing: false });
      }
    })().finally(() => {
      flight = null;
    });
    return flight;
  },
  saveFitness: async (record) => {
    const exists = get().fitness.find((r) => r.id === record.id);
    set((s) => ({
      fitness: [
        ...s.fitness.filter((r) => r.id !== record.id),
        { ...record, version: exists ? exists.version + 1 : 1 },
      ],
    }));
    const { id, version, deleted_at, ...body } = record;
    await enqueue({
      method: exists ? "patch" : "put",
      url: "/api/v2/fitness/" + id,
      body: exists ? { ...body, version: exists.version } : body,
    });
  },
  deleteFitness: async (id) => {
    set((s) => ({
      fitness: s.fitness.map((r) =>
        r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r,
      ),
    }));
    await enqueue({ method: "delete", url: "/api/v2/fitness/" + id });
  },
  addFood: async (food, quantity, meal, source = "catalog") => {
    const now = new Date().toISOString();
    const base: Nutrition = {
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g ?? null,
    };
    const entry: Entry = {
      id: Crypto.randomUUID(),
      log_date: get().date,
      name: food.name,
      food_id: food.id,
      meal_type: meal,
      quantity,
      serving_unit: `${food.serving_qty} ${food.serving_unit}`,
      base_nutrition: base,
      ...totals(base, quantity),
      source,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    set((s) => ({ entries: [...s.entries, entry] }));
    await enqueue({
      method: "put",
      url: "/api/v2/entries/" + entry.id,
      body: entry,
    });
    return entry;
  },
  editEntry: async (id, quantity, meal) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const updated = {
      ...entry,
      quantity,
      meal_type: meal,
      ...totals(entry.base_nutrition, quantity),
      version: entry.version + 1,
      updated_at: new Date().toISOString(),
    };
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? updated : e)),
    }));
    await enqueue({
      method: "patch",
      url: "/api/v2/entries/" + id,
      body: { version: entry.version, quantity, meal_type: meal },
    });
  },
  deleteEntry: async (id) => {
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : e,
      ),
    }));
    await enqueue({ method: "delete", url: "/api/v2/entries/" + id });
  },
  addWater: async (ml) => {
    const now = new Date().toISOString();
    const entry: Water = {
      id: Crypto.randomUUID(),
      log_date: get().date,
      amount_ml: ml,
      created_at: now,
      updated_at: now,
    };
    set((s) => ({ water: [...s.water, entry] }));
    await enqueue({
      method: "put",
      url: "/api/v2/water/" + entry.id,
      body: { log_date: entry.log_date, amount_ml: ml },
    });
  },
  deleteWater: async (id) => {
    set((s) => ({
      water: s.water.map((w) =>
        w.id === id
          ? {
              ...w,
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : w,
      ),
    }));
    await enqueue({ method: "delete", url: "/api/v2/water/" + id });
  },
  saveFood: async (food) => {
    set((s) => ({ foods: [food, ...s.foods] }));
    await enqueue({
      method: "put",
      url: "/api/v2/foods/custom/" + food.id,
      body: food,
    });
  },
  checkIn: async () => {
    if (!get().queue.some((o) => o.url === "/api/v2/check-in"))
      await enqueue({ method: "post", url: "/api/v2/check-in" });
  },
}));
onSessionExpired(() => {
  useTracker.setState({
    uid: null,
    entries: [],
    water: [],
    foods: [],
    fitness: [],
    queue: [],
    progress: emptyProgress,
    ready: false,
    syncing: false,
    error: null,
    notice: null,
  });
});
export const totalNutrition = (entries: Entry[]) =>
  entries.reduce(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein_g: t.protein_g + e.protein_g,
      carbs_g: t.carbs_g + e.carbs_g,
      fat_g: t.fat_g + e.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
export function currentEntries() {
  const s = useTracker.getState();
  return s.entries.filter((e) => e.log_date === s.date && !e.deleted_at);
}
