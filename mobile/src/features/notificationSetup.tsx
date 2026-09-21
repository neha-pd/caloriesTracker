import React, { useEffect, useState } from "react";
import { AppState, Linking, Modal, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useIsFocused } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { Banner, Button, C, Card, T } from "./ui";
async function notifications() {
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("daily-habits", {
      name: "Daily habits",
      importance: N.AndroidImportance.DEFAULT,
    });
  return N;
}
export function NotificationPermissionCard() {
  const focused = useIsFocused();
  const [status, setStatus] = useState("Checking…"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    if (Platform.OS === "web") {
      setStatus("Available in the phone app");
      return;
    }
    const N = await notifications(),
      p = await N.getPermissionsAsync();
    const provisional = p.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
    setStatus(
      p.granted
        ? "Allowed"
        : provisional
          ? "Quiet delivery only"
          : p.canAskAgain
            ? "Not requested yet"
            : "Blocked in device settings",
    );
  }
  useEffect(() => {
    if (focused)
      void refresh().catch(() => setStatus("Could not read permission"));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [focused]);
  async function enable(test = false) {
    setBusy(true);
    setMessage("");
    try {
      const N = await notifications(),
        permission = await N.requestPermissionsAsync();
      await refresh();
      if (!permission.granted)
        throw new Error(
          "Notifications are not allowed. Open device settings to enable them.",
        );
      if (test) {
        await N.scheduleNotificationAsync({
          content: {
            title: "Ember is here",
            body: "Your local reminders are ready. Choose a schedule in FitLens.",
            data: { fitlens: true, route: "/coach" },
            sound: false,
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 5,
            channelId: "daily-habits",
          },
        });
        setMessage(
          "Test scheduled for 5 seconds from now. Permission alone does not enable recurring reminders; choose a schedule below.",
        );
      } else
        setMessage("Permission allowed. Choose a reminder schedule below.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not set up notifications.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <T bold>Notification permission · {status}</T>
      <T color={C.muted} size={13}>
        Your phone delivers scheduled reminders. AI downloads, camera access and
        microphone access are separate settings.
      </T>
      {Platform.OS !== "web" && (
        <>
          <Button
            title="Enable notifications"
            disabled={busy}
            onPress={() => void enable()}
          />
          <Button
            secondary
            title="Send a test notification"
            disabled={busy}
            onPress={() => void enable(true)}
          />
          <Button
            secondary
            title="Open notification settings"
            onPress={() => void Linking.openSettings()}
          />
        </>
      )}
      {message && <Banner text={message} />}
    </Card>
  );
}
export default function NotificationSetup() {
  const user = useAuthStore((s) => s.user),
    [show, setShow] = useState(false);
  useEffect(() => {
    let valid = true;
    if (
      Platform.OS !== "web" &&
      user?.onboarding_complete &&
      user.id !== "fitlens-offline-demo"
    )
      void AsyncStorage.getItem("fitlens:permission-intro-v1")
        .then((seen) => {
          if (valid && !seen) setShow(true);
        })
        .catch(() => {});
    else setShow(false);
    return () => {
      valid = false;
    };
  }, [user?.id, user?.onboarding_complete]);
  async function close(open: boolean) {
    await AsyncStorage.setItem("fitlens:permission-intro-v1", "seen");
    setShow(false);
    if (open) router.push("/reminders");
  }
  return (
    <Modal
      visible={show}
      transparent
      animationType="fade"
      onRequestClose={() => void close(false)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#000b",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card>
          <T bold size={25}>
            Make FitLens yours.
          </T>
          <T>
            Enable reminders so Ember can nudge you even when the app is closed.
          </T>
          <T color={C.muted}>
            On the next screen, allow notifications and send a test. Camera and
            microphone permissions are requested when you use them. Each local
            AI model asks before downloading.
          </T>
          <Button
            title="Set up notifications"
            onPress={() => void close(true)}
          />
          <Button
            secondary
            title="Maybe later"
            onPress={() => void close(false)}
          />
        </Card>
      </View>
    </Modal>
  );
}
