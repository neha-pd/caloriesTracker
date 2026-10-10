import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Profile } from "./domain";
export async function enableReminders(profile: Profile, uid: string) {
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("fitkin-training", {
      name: "Workout reminders",
      importance: N.AndroidImportance.DEFAULT,
    });
  const p = await N.requestPermissionsAsync();
  if (!p.granted)
    throw Error(
      "Notifications are off. Enable them in your phone settings, then try again.",
    );
  await disableReminders(uid);
  const [hour, minute] = profile.time.split(":").map(Number),
    ids: string[] = [];
  try {
    for (const day of profile.days)
      ids.push(
        await N.scheduleNotificationAsync({
          content: {
            title: "A little movement is waiting",
            body:
              profile.tone === "playful"
                ? "Your workout called. It says a small start counts."
                : "Your planned workout is ready. Start when you feel ready.",
            data: { fitlens: true, route: "/train" },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1,
            hour,
            minute,
            channelId: "fitkin-training",
          },
        }),
      );
  } catch (e) {
    await Promise.all(ids.map((id) => N.cancelScheduledNotificationAsync(id)));
    throw e;
  }
  await AsyncStorage.setItem(
    "fitkin:train:notifications:" + uid,
    JSON.stringify(ids),
  );
  return "Workout reminders enabled on this device.";
}
export async function disableReminders(uid: string) {
  const N = await import("expo-notifications");
  const ids = JSON.parse(
    (await AsyncStorage.getItem("fitkin:train:notifications:" + uid)) || "[]",
  );
  await Promise.all(
    ids.map((id: string) => N.cancelScheduledNotificationAsync(id)),
  );
  await AsyncStorage.removeItem("fitkin:train:notifications:" + uid);
}
export async function restAlert() {
  const N = await import("expo-notifications");
  const p = await N.getPermissionsAsync();
  if (p.granted)
    await N.scheduleNotificationAsync({
      content: {
        title: "Rest complete",
        body: "Ready for your next set? Take longer if you need it.",
      },
      trigger: null,
    });
}
export async function syncCompletion(_uid: string, _date: string) {}
export async function installApp() {
  return "Use your phone’s app installer for the native Fitkin app.";
}
export async function downloadFile(name: string, text: string, type: string) {
  const { File, Paths } = await import("expo-file-system");
  const S = await import("expo-sharing");
  const file = new File(Paths.cache, name);
  file.write(text);
  if (await S.isAvailableAsync())
    await S.shareAsync(file.uri, { mimeType: type });
  else throw Error("Sharing is not available on this device.");
}

export const pauseReminders = disableReminders;
