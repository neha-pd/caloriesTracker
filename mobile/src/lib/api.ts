import axios from "axios";
import * as Crypto from "expo-crypto";
import { sheetsAdapter, refreshFirebase } from "./sheets";
import {
  isDemoMode,
  getSecret,
  saveTokens,
  clearSession,
  sessionGeneration,
} from "./session";
import { demoAdapter } from "./demoApi";
export const api = axios.create({
  adapter: sheetsAdapter,
  timeout: 70000,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use(async (config) => {
  if (isDemoMode()) {
    config.adapter = demoAdapter;
    return config;
  }
  if (!config.headers.has("X-Fitkin-Request-Id"))
    config.headers.set("X-Fitkin-Request-Id", Crypto.randomUUID());
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
        const data = await refreshFirebase(token, original);
        if (generation !== sessionGeneration())
          throw new Error("Session ended");
        await saveTokens(data);
      })().finally(() => {
        refresh = null;
      });
    try {
      await refresh;
      if (generation !== sessionGeneration()) throw new Error("Session ended");
      return await api(original);
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
