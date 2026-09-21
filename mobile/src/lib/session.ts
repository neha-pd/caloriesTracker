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
export async function getSecret(key: string) {
  return Platform.OS === "web"
    ? typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
export async function setSecret(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key, value);
  } else await SecureStore.setItemAsync(key, value);
}
export async function clearSession() {
  generation++;
  demoMode = false;
  await AsyncStorage.removeItem("fitlens:demo-active");
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
    }
  } else
    await Promise.all(
      ["access_token", "refresh_token"].map((key) =>
        SecureStore.deleteItemAsync(key),
      ),
    );
  listeners.forEach((fn) => fn());
}
export async function saveTokens(data: {
  token: string;
  refresh_token: string;
}) {
  await setSecret("access_token", data.token);
  await setSecret("refresh_token", data.refresh_token);
}
