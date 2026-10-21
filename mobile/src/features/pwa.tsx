import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { Page, Card, T, C, Button, Banner } from "./ui";
export function installed() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true)
  );
}
export function InstallCard() {
  if (Platform.OS !== "web" || installed()) return null;
  return (
    <Card>
      <T bold size={19}>
        Fitkin, one tap away.
      </T>
      <T color={C.muted}>
        Add it to your Home Screen for an app-like experience on iPhone.
      </T>
      <Button
        secondary
        title="Add Fitkin to my Home Screen"
        onPress={() => router.push("/install")}
      />
    </Card>
  );
}
export default function Install() {
  const [offline, setOffline] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    if (Platform.OS === "web" && "serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then(() => {
        if (alive) setOffline(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Page
      back
      eyebrow="FITKIN FOR IPHONE"
      title="A home for your little wins."
      subtitle="The same Fitkin account, right on your Home Screen."
    >
      <Card>
        <T bold size={21}>
          {installed()
            ? "You’re using the installed app."
            : "Add it from Safari"}
        </T>
        <T>1. Open this website in Safari.</T>
        <T>2. Tap Share, then Add to Home Screen.</T>
        <T>3. Keep Open as Web App enabled if shown, then tap Add.</T>
        <T color={C.muted}>
          Open the new Fitkin icon and sign in with your existing email and
          password. Safari and the installed app may keep separate sign-ins.
        </T>
      </Card>
      {Platform.OS === "web" &&
        (window as any).fitkinInstallPrompt &&
        !installed() && (
          <Button
            title="Install Fitkin"
            onPress={() => {
              const prompt = (window as any).fitkinInstallPrompt;
              void prompt
                .prompt()
                .catch(() =>
                  setMessage("Use your browser’s Add to Home Screen option."),
                );
            }}
          />
        )}
      <Card>
        <T bold>
          {offline ? "Ready for offline use" : "Preparing offline access…"}
        </T>
        <T color={C.muted}>
          Keep this page open online until it is ready. Saved food, activity and
          Train data stay on this device; pending diary edits sync when you
          reconnect. First sign-in and Kin chat need internet.
        </T>
      </Card>
      <Card>
        <T bold>What works on iPhone</T>
        <T>
          Food and water, manual workouts, progress, Train plans, share cards
          and Kin chat.
        </T>
        <T color={C.muted}>
          Apple Watch / Apple Health sync and Android widgets are not available
          in the PWA. Reminders can be exported to your calendar; this version
          does not send background push alerts.
        </T>
      </Card>
      <T size={12} color={C.muted}>
        Use a personal device. Your sign-in stays saved until you log out.
        Clearing website data or removing the app can erase unsynced edits and
        local training plans.
      </T>
      {!!message && <Banner text={message} />}
    </Page>
  );
}
