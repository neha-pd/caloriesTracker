import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AxiosAdapter } from "axios";
import { DEMO_ID } from "../features/demo/data";
export const demoAdapter: AxiosAdapter = async (config) => {
  const url = config.url || "",
    method = config.method || "get";
  let body =
    typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  const raw = await AsyncStorage.getItem("fitlens:demo-profile");
  if (!raw) throw new Error("Demo profile not loaded.");
  let user = JSON.parse(raw),
    data: any;
  if (url === "/api/users/me/export") {
    const tracker = JSON.parse(
      (await AsyncStorage.getItem("fitlens:data:" + DEMO_ID)) || "{}",
    );
    data = {
      demo: true,
      user,
      entries: tracker.entries || [],
      water: tracker.water || [],
      progress: tracker.progress,
    };
  } else if (url === "/api/users/me" && method === "delete") {
    await AsyncStorage.removeItem("fitlens:data:" + DEMO_ID);
    await AsyncStorage.removeItem("fitlens:demo-profile");
    data = { ok: true };
  } else if (url.startsWith("/api/users/me")) {
    if (method === "patch") {
      if (url.endsWith("/settings"))
        user.settings = { ...user.settings, ...body };
      else user = { ...user, ...body };
      await AsyncStorage.setItem("fitlens:demo-profile", JSON.stringify(user));
    }
    data = { user };
  } else
    throw new Error(
      "This action needs a real account. Exit the offline demo to continue.",
    );
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
