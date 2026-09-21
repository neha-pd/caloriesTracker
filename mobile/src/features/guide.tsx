import React, { useState, useEffect } from "react";
import { router, useIsFocused } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/authStore";
import { Art, Button, C, Card, Page, T, Meter } from "./ui";
const key = (id: string) => "fitlens:guide:" + id;
export function GuidePrompt() {
  const uid = useAuthStore((s) => s.user?.id),
    focused = useIsFocused(),
    [show, setShow] = useState(false);
  useEffect(() => {
    let active = true;
    if (uid)
      void AsyncStorage.getItem(key(uid)).then((v) => {
        if (active) setShow(v !== "done");
      });
    return () => {
      active = false;
    };
  }, [uid, focused]);
  return show ? (
    <Card>
      <T bold>New here? Make yourself at home.</T>
      <T color={C.muted}>
        A one-minute guide to food, devices, reminders and XP.
      </T>
      <Button
        secondary
        title="Show me around"
        onPress={() => router.push("/guide")}
      />
    </Card>
  ) : null;
}
export default function Guide() {
  const uid = useAuthStore((s) => s.user?.id),
    [step, setStep] = useState(0);
  const steps = [
    [
      "Start with what you ate.",
      "Tap Add food. Search the offline library in English or try names like poha, dosa and rajma. Use the Indian filter for regional dishes. If something is missing, save your own food.",
    ],
    [
      "Choose your portion.",
      "Library nutrition starts at 100 g. Pick a common portion or adjust the quantity before adding it to a meal. Home-style recipes are estimates; ingredients, oil and cooking change the numbers.",
    ],
    [
      "Connect your device.",
      "Find Connect device right on Home. Android uses Health Connect; iPhone uses Apple Health. Your watch must first sync with its health app. Review permissions there, then FitLens can read supported activity.",
    ],
    [
      "Make a routine that fits.",
      "Open Reminders to choose times or regular intervals. Your phone asks for notification permission when needed. Quiet hours protect 22:00–08:00. Reminders work without chat or an internet connection once scheduled.",
    ],
    [
      "Little wins add up.",
      "Each new food today earns 10 XP for the first 20 entries. The first entry in each meal category adds 25 XP. Water adds 15 XP once daily; checking in adds 10. Offline XP appears immediately and is confirmed on sync. Edits and retries do not earn extra.",
    ],
    [
      "Food and movement, together.",
      "Home rings show food, active burn and workout time. Total burn includes resting energy when your device supplies it. Tap + to log a workout or weigh-in. Auto prevents manual workouts being added on top of watch totals; choose Not captured only when your watch missed it. Progress opens a month calendar or year view; share either period as a PNG. Missing readings stay unknown.",
    ],
    [
      "Meet Ember.",
      "Open Chat with Ember for meal ideas and support. Turn on Use my diary & goals for personal context. Messages go to online AI providers using free capacity. Review any reminder draft before scheduling. Share your day from Home when you want to send a story or a detailed report to your coach.",
    ],
  ];
  async function finish() {
    if (uid) await AsyncStorage.setItem(key(uid), "done");
    router.dismissTo("/(tabs)/dashboard");
  }
  return (
    <Page
      back
      eyebrow={`YOUR QUICK START · ${step + 1} / ${steps.length}`}
      title={steps[step][0]}
    >
      <Art size={120} />
      <Meter value={((step + 1) / steps.length) * 100} />
      <Card>
        <T size={18}>{steps[step][1]}</T>
      </Card>
      {step === 2 && (
        <Button
          secondary
          title="Device connection settings"
          onPress={() => router.push("/health")}
        />
      )}{" "}
      {step === 3 && (
        <Button
          secondary
          title="Set up notifications"
          onPress={() => router.push("/reminders")}
        />
      )}
      <Button
        title={step === steps.length - 1 ? "Let’s get started" : "Next"}
        onPress={() =>
          step === steps.length - 1 ? void finish() : setStep(step + 1)
        }
      />
      {step > 0 && (
        <Button secondary title="Previous" onPress={() => setStep(step - 1)} />
      )}
      <Button secondary title="Skip guide" onPress={() => void finish()} />
    </Page>
  );
}
