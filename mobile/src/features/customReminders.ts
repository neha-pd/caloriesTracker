import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useAuthStore } from "../store/authStore";
import {
  validateReminder,
  reminderWeekdays,
  reminderTimes,
  type CustomReminder,
  type ReminderDraft,
} from "./reminderDomain";
const key = (uid: string) => "fitlens:custom-reminders:" + uid;
export async function listCustomReminders(
  uid: string,
): Promise<CustomReminder[]> {
  const raw = await AsyncStorage.getItem(key(uid));
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export async function reconcileReminders(uid: string) {
  const all = await listCustomReminders(uid);
  if (Platform.OS === "web") return all;
  const N = await import("expo-notifications"),
    scheduled = await N.getAllScheduledNotificationsAsync();
  const active = new Set(scheduled.map((n) => n.identifier));
  const result = all.map((r) => ({
    ...r,
    enabled:
      r.notificationIds.length > 0 &&
      r.notificationIds.every((id) => active.has(id)),
  }));
  await AsyncStorage.setItem(key(uid), JSON.stringify(result));
  return result;
}
export async function saveCustomReminder(
  uid: string,
  draft: ReminderDraft,
  existing?: CustomReminder,
  assignedId?: string,
) {
  const clean = validateReminder(draft);
  if (Platform.OS === "web")
    throw new Error(
      "Scheduling reminders requires the native phone app. You can preview and edit the draft here.",
    );
  if (useAuthStore.getState().user?.id !== uid)
    throw new Error("Sign in before scheduling a reminder.");
  const all = await listCustomReminders(uid);
  if (!existing && all.length >= 8)
    throw new Error(
      "You can keep up to 8 custom reminders. Remove one before adding another.",
    );
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("daily-habits", {
      name: "Daily habits",
      importance: N.AndroidImportance.DEFAULT,
    });
  const permission = await N.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Allow notifications in your device settings to schedule this reminder.",
    );
  const times = reminderTimes(clean);
  const days = reminderWeekdays(clean.cadence);
  const pending = await N.getAllScheduledNotificationsAsync();
  // Keep old triggers until the replacement is persisted; budget for both sets.
  if (pending.length + times.length * Math.max(1, days.length) > 60)
    throw new Error(
      "This schedule would create too many notifications. Choose a longer interval, daily instead of weekdays, or pause a reminder first.",
    );
  const id = existing?.id || assignedId || Crypto.randomUUID(),
    notificationIds: string[] = [];
  try {
    const content = {
      title: clean.title,
      body: clean.body,
      sound: false as const,
      data: { fitlens: true, route: "/coach" },
    };
    for (const time of times) {
      if (!days.length)
        notificationIds.push(
          await N.scheduleNotificationAsync({
            content,
            trigger: {
              type: N.SchedulableTriggerInputTypes.DAILY,
              hour: time.hour,
              minute: time.minute,
              channelId: "daily-habits",
            },
          }),
        );
      else
        for (const weekday of days)
          notificationIds.push(
            await N.scheduleNotificationAsync({
              content,
              trigger: {
                type: N.SchedulableTriggerInputTypes.WEEKLY,
                weekday,
                hour: time.hour,
                minute: time.minute,
                channelId: "daily-habits",
              },
            }),
          );
    }
    if (useAuthStore.getState().user?.id !== uid)
      throw new Error("Your session ended before the reminder was saved.");
    const reminder: CustomReminder = {
      ...clean,
      id,
      notificationIds,
      enabled: true,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      key(uid),
      JSON.stringify(
        existing
          ? all.map((r) => (r.id === id ? reminder : r))
          : [...all, reminder],
      ),
    );
  } catch (e) {
    await Promise.all(
      notificationIds.map((id) => N.cancelScheduledNotificationAsync(id)),
    );
    throw e;
  }
  if (existing)
    await Promise.all(
      existing.notificationIds.map((id) =>
        N.cancelScheduledNotificationAsync(id),
      ),
    );
}
export async function pauseCustomReminder(
  uid: string,
  id: string,
  remove = false,
) {
  const all = await listCustomReminders(uid),
    reminder = all.find((r) => r.id === id);
  if (!reminder) return;
  if (Platform.OS !== "web") {
    const N = await import("expo-notifications");
    await Promise.all(
      reminder.notificationIds.map((id) =>
        N.cancelScheduledNotificationAsync(id),
      ),
    );
  }
  await AsyncStorage.setItem(
    key(uid),
    JSON.stringify(
      remove
        ? all.filter((r) => r.id !== id)
        : all.map((r) =>
            r.id === id ? { ...r, enabled: false, notificationIds: [] } : r,
          ),
    ),
  );
}

// Stable draft IDs make retries safe; previously saved group items are not scheduled twice.
export async function saveReminderBatch(
  uid: string,
  drafts: { id: string; draft: ReminderDraft }[],
) {
  if (
    !drafts.length ||
    drafts.length > 8 ||
    new Set(drafts.map((x) => x.id)).size !== drafts.length
  )
    throw new Error("Choose between one and eight distinct reminders.");
  const clean = drafts.map((x) => ({ ...x, draft: validateReminder(x.draft) }));
  const before = await listCustomReminders(uid);
  const pending = clean.filter((x) => !before.some((r) => r.id === x.id));
  if (before.length + pending.length > 8)
    throw new Error(
      "This group exceeds the limit of 8 custom reminders. Remove an old reminder first.",
    );
  const created: string[] = [];
  try {
    for (const x of pending) {
      await saveCustomReminder(uid, x.draft, undefined, x.id);
      created.push(x.id);
    }
  } catch (error) {
    for (const id of created) await pauseCustomReminder(uid, id, true);
    throw error;
  }
}
