import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  isDemoMode,
  getSecret,
  saveTokens,
  clearSession,
  sessionGeneration,
} from "./session";
import { demoAdapter } from "./demoApi";
const host = Constants.expoConfig?.hostUri?.split(":")[0];
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web"
    ? "http://localhost:3000"
    : host
      ? `http://${host}:3000`
      : Platform.OS === "android"
        ? "http://10.0.2.2:3000"
        : "http://localhost:3000");
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 70000,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use(async (config) => {
  if (isDemoMode()) {
    config.adapter = demoAdapter;
    return config;
  }
  const token = await getSecret("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refresh: Promise<void> | null = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url?.includes("/auth/")
    )
      return Promise.reject(error);
    original._retry = true;
    const generation = sessionGeneration();
    if (!refresh)
      refresh = (async () => {
        const token = await getSecret("refresh_token");
        if (!token) throw error;
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          { refresh_token: token },
          { timeout: 70000 },
        );
        if (generation !== sessionGeneration())
          throw new Error("Session ended");
        await saveTokens(data);
      })().finally(() => {
        refresh = null;
      });
    try {
      await refresh;
      if (generation !== sessionGeneration()) throw new Error("Session ended");
      return api(original);
    } catch (e: any) {
      if (e?.response?.status === 401 || !(await getSecret("refresh_token")))
        await clearSession();
      return Promise.reject(e);
    }
  },
);
export function errorMessage(error: any) {
  return (
    error?.response?.data?.error ??
    (error?.code === "ERR_NETWORK"
      ? "You’re offline. Your saved data is still here."
      : (error?.message ?? "Something went wrong. Try again."))
  );
}
export default api;
