import { reminderSummary } from "./reminderDomain";
import React, { useEffect, useState } from "react";
import { Platform, Switch, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useIsFocused } from "expo-router";
import { reconcileReminders, pauseCustomReminder } from "./customReminders";
import type { CustomReminder } from "./reminderDomain";
import { Banner, Button, C, Card, Page, S, T } from "./ui";
import { useAuthStore } from "../store/authStore";
import { onSessionExpired } from "../lib/session";
import { NotificationPermissionCard } from "./notificationSetup";
const choices = [
  {
    key: "meal",
    title: "A mindful meal",
    body: "A gentle lunch check-in · 12:30",
    hour: 12,
    minute: 30,
  },
  {
    key: "water",
    title: "A refreshing pause",
    body: "A little afternoon sip · 15:00",
    hour: 15,
    minute: 0,
  },
  {
    key: "quest",
    title: "Your daily spark",
    body: "An evening moment for you · 19:00",
    hour: 19,
    minute: 0,
  },
];
export async function clearReminders() {
  if (Platform.OS !== "web") {
    const N = await import("expo-notifications");
    await N.cancelAllScheduledNotificationsAsync();
  }
}
onSessionExpired(() => {
  void clearReminders().catch(() => {});
});
export default function Reminders() {
  const uid = useAuthStore((s) => s.user?.id),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const focused = useIsFocused();
  const [custom, setCustom] = useState<CustomReminder[]>([]);
  async function reload() {
    if (uid) setCustom(await reconcileReminders(uid));
  }
  useEffect(() => {
    if (focused) void reload().catch((e) => setError(String(e)));
  }, [uid, focused]);
  useEffect(() => {
    if (!uid || Platform.OS === "web") return;
    void (async () => {
      const N = await import("expo-notifications");
      const scheduled = await N.getAllScheduledNotificationsAsync();
      const known: Record<string, string> = JSON.parse(
        (await AsyncStorage.getItem("fitlens:reminders:" + uid)) || "{}",
      );
      setSelected(
        Object.fromEntries(
          Object.entries(known).filter(([, id]) =>
            scheduled.some((n) => n.identifier === id),
          ),
        ),
      );
    })();
  }, [uid]);
  async function toggle(key: string, value: boolean) {
    if (Platform.OS === "web") {
      setError("Local reminders are available in the native phone app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const N = await import("expo-notifications");
      if (Platform.OS === "android")
        await N.setNotificationChannelAsync("daily-habits", {
          name: "Daily habits",
          importance: N.AndroidImportance.DEFAULT,
        });
      const next = { ...selected };
      if (value) {
        const permission = await N.requestPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Notifications are off. Enable them in your device settings.",
          );
        const c = choices.find((c) => c.key === key)!;
        next[key] = await N.scheduleNotificationAsync({
          content: {
            title: c.title,
            data: {
              fitlens: true,
              route:
                key === "meal"
                  ? "/log"
                  : key === "water"
                    ? "/water"
                    : "/(tabs)/quests",
            },
            body:
              key === "meal"
                ? "Enjoyed something good? Make a little note in your diary."
                : key === "water"
                  ? "Take a moment to pause and sip some water."
                  : "You made it through today. Check in with Ember when you’re ready.",
            sound: false,
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DAILY,
            hour: c.hour,
            minute: c.minute,
            channelId: "daily-habits",
          },
        });
      } else {
        if (next[key]) await N.cancelScheduledNotificationAsync(next[key]);
        delete next[key];
      }
      await AsyncStorage.setItem(
        "fitlens:reminders:" + uid,
        JSON.stringify(next),
      );
      setSelected(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update reminders.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="A GENTLE NUDGE"
      title="At your own pace."
      subtitle="Daily reminders on this device, in your local time. You can switch them off anytime."
    >
      <NotificationPermissionCard />
      <Button
        title="Create a custom reminder"
        testID="custom-reminder"
        onPress={() => router.push("/reminder-editor")}
      />
      {custom.map((r) => (
        <Card key={r.id}>
          <T bold size={18}>
            {r.title}
          </T>
          <T color={C.muted}>{r.body}</T>
          <T color={C.lime}>
            {reminderSummary(r)} · {r.cadence} ·{" "}
            {r.enabled ? "Scheduled" : "Paused"}
          </T>
          <Button
            secondary
            title={r.enabled ? "Edit reminder" : "Review & enable"}
            onPress={() =>
              router.push({
                pathname: "/reminder-editor",
                params: { id: r.id },
              })
            }
          />
          {r.enabled && (
            <Button
              secondary
              title="Pause reminder"
              onPress={() =>
                void pauseCustomReminder(uid!, r.id)
                  .then(reload)
                  .catch((e) => setError(String(e)))
              }
            />
          )}
          <Button
            secondary
            title="Remove reminder"
            onPress={() =>
              void pauseCustomReminder(uid!, r.id, true)
                .then(reload)
                .catch((e) => setError(String(e)))
            }
          />
        </Card>
      ))}
      <T bold size={19}>
        Quick reminders
      </T>
      {choices.map((c) => (
        <Card key={c.key}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <T bold size={18}>
                {c.title}
              </T>
              <T color={C.muted} size={13}>
                {c.body}
              </T>
            </View>
            <Switch
              disabled={busy}
              accessibilityLabel={c.title}
              value={!!selected[c.key]}
              onValueChange={(v) => void toggle(c.key, v)}
              trackColor={{ true: C.lime, false: C.border }}
            />
          </View>
        </Card>
      ))}
      {error && <Banner error text={error} />}
      <T size={12} color={C.muted}>
        Reminders stop when you log out. After changing your device timezone,
        toggle reminders off and on to reset their schedule.
      </T>
    </Page>
  );
}
