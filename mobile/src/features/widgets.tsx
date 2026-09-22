import React, { useEffect, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { useTracker, totalNutrition } from "./tracker";
import { useAuthStore } from "../store/authStore";
import { localDateKey } from "../lib/dates";
import { onSessionExpired } from "../lib/session";
import { Banner, Button, C, Card, Icon, Page, S, Segments, T } from "./ui";
const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<{
        update: (json: string) => void;
        pin: (kind: string) => boolean;
      }>("FitLensWidgets")
    : null;
const useWidgetOptions = create<{ theme: string; showNutrition: boolean }>(
  () => ({ theme: "midnight", showNutrition: true }),
);
onSessionExpired(() => {
  native?.update("{}");
});
export function WidgetBridge() {
  const tracker = useTracker(),
    user = useAuthStore((s) => s.user),
    options = useWidgetOptions();
  useEffect(() => {
    void AsyncStorage.getItem("fitlens:widget-options").then((raw) => {
      if (raw) {
        try {
          useWidgetOptions.setState(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);
  useEffect(() => {
    if (!native) return;
    const date = localDateKey(),
      entries = tracker.entries.filter(
        (e) => e.log_date === date && !e.deleted_at,
      ),
      water = tracker.water
        .filter((w) => w.log_date === date && !w.deleted_at)
        .reduce((a, w) => a + w.amount_ml, 0);
    const totals = totalNutrition(entries);
    native.update(
      JSON.stringify({
        signedIn: !!user && tracker.uid === user.id && tracker.ready,
        demo: user?.id === "fitlens-offline-demo",
        date,
        ...options,
        calories: Math.round(totals.calories),
        goal: user?.calorie_goal || 2000,
        foods: entries.length,
        water,
        waterGoal: user?.settings.water_goal_ml || 2000,
        streak: tracker.progress.streak,
      }),
    );
  }, [
    tracker.entries,
    tracker.water,
    tracker.progress,
    tracker.ready,
    tracker.uid,
    user,
    options,
  ]);
  return null;
}
export default function Widgets() {
  const options = useWidgetOptions(),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function update(values: Partial<typeof options>) {
    const next = { ...options, ...values };
    useWidgetOptions.setState(next);
    await AsyncStorage.setItem("fitlens:widget-options", JSON.stringify(next));
  }
  function pin(kind: string) {
    setError("");
    setMessage("");
    if (!native) {
      setMessage(
        "Android home-screen widgets are included in the APK. Install it on your phone to add one.",
      );
      return;
    }
    try {
      const requested = native.pin(kind);
      setMessage(
        requested
          ? "Confirm Add on your home screen to place the widget."
          : "Your launcher does not support in-app pinning. Long-press your home screen, choose Widgets, then Fitkin.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the widget.");
    }
  }
  return (
    <Page
      back
      eyebrow="YOUR SPARK, AT A GLANCE"
      title="Make yourself at home."
      subtitle="Custom Android home-screen widgets, designed to match your routine."
    >
      <Segments
        values={[
          { key: "midnight", label: "Midnight" },
          { key: "cream", label: "Soft cream" },
        ]}
        value={options.theme}
        onChange={(v) => void update({ theme: v })}
      />
      <Card>
        <View style={S.row}>
          <View style={{ flex: 1 }}>
            <T bold>Show nutrition totals</T>
            <T color={C.muted} size={12}>
              Visible on your home screen. Turn off to show food-entry counts
              instead.
            </T>
          </View>
          <Switch
            accessibilityLabel="Show widget nutrition"
            value={options.showNutrition}
            onValueChange={(v) => void update({ showNutrition: v })}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </View>
      </Card>
      {[
        {
          kind: "today",
          icon: "sunny-outline" as const,
          title: "Daily spark",
          body: "Calories versus your target, water, and shortcuts to food and water logging.",
        },
        {
          kind: "water",
          icon: "water-outline" as const,
          title: "Hydration pause",
          body: "Your water total and target, with a shortcut to log your next sip.",
        },
        {
          kind: "coach",
          icon: "sparkles-outline" as const,
          title: "Kin check-in",
          body: "Your streak and a shortcut to the private daily coach.",
        },
      ].map((w) => (
        <Card
          key={w.kind}
          style={
            options.theme === "cream" ? { backgroundColor: "#f4f0e5" } : {}
          }
        >
          <Icon
            name={w.icon}
            color={options.theme === "cream" ? "#385321" : C.lime}
          />
          <T
            bold
            size={22}
            color={options.theme === "cream" ? "#192414" : C.text}
          >
            {w.title}
          </T>
          <T color={options.theme === "cream" ? "#596451" : C.muted}>
            {w.body}
          </T>
          <Button
            title={`Add ${w.title} widget`}
            testID={`widget-${w.kind}`}
            onPress={() => pin(w.kind)}
          />
        </Card>
      ))}
      {message && <Banner text={message} />}
      {error && <Banner error text={error} />}
      <T color={C.muted} size={12}>
        Widgets show the last totals saved while the app was open and clear
        account details after logout. Shortcuts open the app; they do not
        silently add entries. At a new day, open Fitkin to refresh. iPhone
        widgets are not included in this Android build.
      </T>
    </Page>
  );
}
