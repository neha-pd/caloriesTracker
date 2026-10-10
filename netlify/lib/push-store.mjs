import { getStore } from "@netlify/blobs";
import webpush from "web-push";
export function stores() {
  return {
    settings: getStore({ name: "fitkin-push-settings", consistency: "strong" }),
    subscriptions: getStore({
      name: "fitkin-push-subscriptions",
      consistency: "strong",
    }),
  };
}
export async function keys() {
  const { settings } = stores();
  let k = await settings.get("vapid", { type: "json" });
  if (!k) {
    await settings.setJSON("vapid", webpush.generateVAPIDKeys(), {
      onlyIfNew: true,
    });
    k = await settings.get("vapid", { type: "json" });
  }
  if (!k) throw Error("Push keys could not be initialized");
  return k;
}
export { webpush };
