import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
let demoMode = false;
export const isDemoMode = () => demoMode;
export const setDemoMode = (value: boolean) => {
  demoMode = value;
};
let generation = 0;
const listeners = new Set<() => void>();
export const sessionGeneration = () => generation;
export const onSessionExpired = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const webKey = (key: string) => "fitkin:session:v1:" + key;
export async function getSecret(key: string) {
  if (Platform.OS !== "web") return SecureStore.getItemAsync(key);
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(webKey(key));
}
export async function setSecret(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(webKey(key), value);
  } else await SecureStore.setItemAsync(key, value);
}
export async function clearSession() {
  generation++;
  demoMode = false;
  await AsyncStorage.removeItem("fitlens:demo-active");
  if (Platform.OS === "web") {
    for (const key of [
      "access_token",
      "refresh_token",
      "sheet_session",
      "backend_version",
    ]) {
      if (typeof localStorage !== "undefined")
        localStorage.removeItem(webKey(key));
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
    }
  } else
    await Promise.all(
      ["access_token", "refresh_token", "sheet_session", "backend_version"].map(
        (key) => SecureStore.deleteItemAsync(key),
      ),
    );
  listeners.forEach((fn) => fn());
}
export async function saveTokens(data: {
  token: string;
  refresh_token: string;
  sheet_session?: string;
}) {
  if (data.sheet_session) {
    await setSecret("sheet_session", data.sheet_session);
    await setSecret("backend_version", "sheets-v1");
  }
  await setSecret("access_token", data.token);
  await setSecret("refresh_token", data.refresh_token);
}

// A sign-in/logout in another tab must not leave a different account's diary
// mounted against the new credentials. Reload into the current session.
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key === webKey("sheet_session") &&
      event.newValue !== event.oldValue
    ) {
      generation++;
      listeners.forEach((fn) => fn());
      window.location.reload();
    }
  });
}
