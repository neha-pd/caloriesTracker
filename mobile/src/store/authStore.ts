import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";
import {
  clearSession,
  setDemoMode,
  getSecret,
  onSessionExpired,
  saveTokens,
  sessionGeneration,
} from "../lib/session";
import { DEMO_ID, buildDemoData, demoUser } from "../features/demo/data";
export interface User {
  id: string;
  email: string;
  display_name: string;
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  goal_type: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  weight_goal_kg: number | null;
  activity_level: string | null;
  timezone: string;
  onboarding_complete: boolean;
  settings: {
    water_goal_ml: number;
    move_goal_kcal?: number | null;
    exercise_goal_minutes?: number | null;
    meal_reminders: boolean;
    water_reminders: boolean;
    quest_reminders: boolean;
    haptics: boolean;
  };
}
interface AuthState {
  enterDemo: () => Promise<void>;
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}
async function accept(data: any) {
  setDemoMode(false);
  await AsyncStorage.removeItem("fitlens:demo-active");
  await saveTokens(data);
  await AsyncStorage.setItem("fitlens:profile", JSON.stringify(data.user));
  useAuthStore.setState({
    user: data.user,
    isLoggedIn: true,
    isLoading: false,
  });
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  enterDemo: async () => {
    await get().logout();
    const existing = await AsyncStorage.getItem("fitlens:data:" + DEMO_ID);
    if (!existing)
      await AsyncStorage.setItem(
        "fitlens:data:" + DEMO_ID,
        JSON.stringify(buildDemoData()),
      );
    const cached = await AsyncStorage.getItem("fitlens:demo-profile");
    const user = cached ? JSON.parse(cached) : demoUser();
    await AsyncStorage.setItem("fitlens:demo-profile", JSON.stringify(user));
    await AsyncStorage.setItem("fitlens:demo-active", "true");
    setDemoMode(true);
    set({ user, isLoggedIn: true, isLoading: false });
  },
  loadSession: async () => {
    try {
      if ((await AsyncStorage.getItem("fitlens:demo-active")) === "true") {
        const raw = await AsyncStorage.getItem("fitlens:demo-profile");
        if (raw) {
          setDemoMode(true);
          set({ user: JSON.parse(raw), isLoggedIn: true, isLoading: false });
          return;
        }
      }
      if (!(await getSecret("access_token"))) {
        set({ isLoading: false });
        return;
      }
      const cached = await AsyncStorage.getItem("fitlens:profile");
      if (cached) set({ user: JSON.parse(cached), isLoggedIn: true });
      await get().refreshUser();
    } catch (e: any) {
      if (e?.response?.status === 401) await clearSession();
    } finally {
      set({ isLoading: false });
    }
  },
  login: async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    await accept(data);
  },
  register: async (email, password, name) => {
    const { data } = await api.post("/api/auth/register", {
      email,
      password,
      display_name: name || "Friend",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await accept(data);
  },
  loginWithGoogle: async (id_token) => {
    const { data } = await api.post("/api/auth/google", { id_token });
    await accept(data);
  },
  logout: async () => {
    try {
      const refresh_token = await getSecret("refresh_token");
      if (refresh_token)
        await api.post(
          "/api/auth/logout",
          { refresh_token },
          { timeout: 8000 },
        );
    } catch {}
    await clearSession();
    await AsyncStorage.removeItem("fitlens:profile");
  },
  refreshUser: async () => {
    const generation = sessionGeneration();
    const { data } = await api.get("/api/users/me");
    if (generation !== sessionGeneration()) return;
    await AsyncStorage.setItem("fitlens:profile", JSON.stringify(data.user));
    set({ user: data.user });
  },
  updateUser: (updates) => {
    const user = get().user;
    if (user) {
      const next = { ...user, ...updates };
      set({ user: next });
      void AsyncStorage.setItem(
        user.id === DEMO_ID ? "fitlens:demo-profile" : "fitlens:profile",
        JSON.stringify(next),
      );
    }
  },
}));
onSessionExpired(() =>
  useAuthStore.setState({ user: null, isLoggedIn: false, isLoading: false }),
);
