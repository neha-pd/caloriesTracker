import React, { useEffect, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { router } from "expo-router";
import { Page, Card, T, C, Button, Banner, S, Segments } from "../ui";
import { DateTimeField } from "../pickers";
import { useNudges, refreshNudgeContext } from "./store";
import { NudgeSettings, nudgeCopy } from "./domain";
import { nudgeNative } from "./native";
import { useHealth } from "../health/store";
export default function SmartNudges() {
  const state = useNudges(),
    health = useHealth(),
    [draft, setDraft] = useState<NudgeSettings>(state.settings),
    [status, setStatus] = useState<any>({}),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => setDraft(state.settings), [state.ready]);
  async function inspect() {
    const n = nudgeNative();
    if (n) setStatus({ ...(await n.status()), ...(await n.capabilities()) });
  }
  useEffect(() => {
    void inspect().catch(() => {});
  }, []);
  const toggle = (
    key: "enabled" | "workouts" | "steps" | "water",
    label: string,
  ) => (
    <View style={S.row}>
      <T style={{ flex: 1 }}>{label}</T>
      <Switch
        accessibilityLabel={label}
        value={draft[key]}
        onValueChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
        trackColor={{ true: C.lime, false: C.border }}
      />
    </View>
  );
  async function background() {
    setBusy(true);
    setError("");
    try {
      if (!health.enabled)
        throw Error("Connect your device in Health & watch sync first.");
      const c = await nudgeNative()?.capabilities();
      if (!c?.background)
        throw Error(
          "Background health reads are unavailable on this phone. Meals still work; watch data refreshes when you open FitLens.",
        );
      const HC = await import("react-native-health-connect");
      await HC.initialize();
      await HC.requestPermission([
        { accessType: "read", recordType: "BackgroundAccessPermission" },
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "ExerciseSession" },
      ]);
      await inspect();
      await refreshNudgeContext();
      const next = await nudgeNative()?.capabilities();
      setMessage(
        next?.granted
          ? "Background health access allowed. Save your choices below."
          : "Background access was not allowed. You can enable it later.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request access.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="A LITTLE PERSONALITY"
      title="Ember, at your pace."
      subtitle="Offline nudges that change with your diary, movement and routine."
    >
      <Card>
        {toggle("enabled", "Enable smart nudges")}
        <T size={12} color={C.muted}>
          Meal reminders skip meals already logged. Wording rotates daily. Water
          checks use your logged water. Movement breaks pause after a recorded
          workout or your step goal is met.
        </T>
      </Card>
      <Card>
        <T bold>Your meal rhythm</T>
        {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
          <DateTimeField
            key={meal}
            mode="time"
            label={meal[0].toUpperCase() + meal.slice(1) + " time"}
            value={draft[meal]}
            onChange={(value) => setDraft((d) => ({ ...d, [meal]: value }))}
          />
        ))}
        <T size={12} color={C.muted}>
          These are gentle check-in windows, not alarms telling you when to eat.
        </T>
      </Card>
      <Card>
        {toggle("workouts", "Nudge me about watch workouts")}
        {toggle("steps", "Celebrate step milestones")}
        {toggle("water", "Personal water check-ins")}
        <T bold>Movement nudges per day</T>
        <Segments
          value={String(draft.fitness)}
          onChange={(v) => setDraft((d) => ({ ...d, fitness: Number(v) }))}
          values={[
            { key: "0", label: "Off" },
            { key: "1", label: "One" },
            { key: "2", label: "Two" },
          ]}
        />
        <T size={12} color={C.muted}>
          Varied daytime moments, at least 30 minutes apart from other smart
          nudges. Up to eight smart notifications per day, including
          celebrations. No guilt for resting.
        </T>
        <Button
          secondary
          title="Choose my step goal"
          onPress={() => router.push("/health")}
        />
      </Card>
      <Card>
        <T bold>Your quiet hours</T>
        <DateTimeField
          label="Quiet hours start"
          mode="time"
          value={draft.quietStart}
          onChange={(v) => setDraft((d) => ({ ...d, quietStart: v }))}
        />
        <DateTimeField
          label="Quiet hours end"
          mode="time"
          value={draft.quietEnd}
          onChange={(v) => setDraft((d) => ({ ...d, quietEnd: v }))}
        />
        <T size={12} color={C.muted}>
          Same start and end means no quiet hours. Details may appear in
          notifications according to your phone’s lock-screen privacy settings.
        </T>
      </Card>
      <Card>
        <T bold>Watch checks while the app is closed</T>
        <T color={C.muted}>
          Android checks locally about every 15 minutes when the system allows.
          No internet is needed once your watch app has written data to Health
          Connect. Battery restrictions and force-stopping FitLens can delay or
          stop checks.
        </T>
        {Platform.OS === "android" ? (
          <>
            <T>
              {status.granted
                ? "Background permission allowed"
                : "Background health access not enabled"}
            </T>
            <Button
              secondary
              title="Allow background watch checks"
              disabled={busy}
              onPress={() => void background()}
            />
            <Button
              secondary
              title="Check now"
              disabled={busy || !state.settings.enabled}
              onPress={() =>
                void nudgeNative()
                  ?.checkNow()
                  .then(() =>
                    setMessage(
                      "Check queued on this phone. Return shortly to see its status.",
                    ),
                  )
              }
            />
            <Button
              secondary
              title="Refresh check status"
              onPress={() => void inspect()}
            />
            {status.lastCheck && (
              <T size={12}>
                Last check: {new Date(status.lastCheck).toLocaleString()} ·{" "}
                {status.healthStatus}
              </T>
            )}
          </>
        ) : (
          <Banner text="Smart background nudges are available in the Android APK. iPhone custom reminders remain available." />
        )}
        <Button
          secondary
          title="Health & watch sync"
          onPress={() => router.push("/health")}
        />
      </Card>
      <Card>
        <T bold>A taste of Ember</T>
        <T>{nudgeCopy.breakfast[0][0]}</T>
        <T color={C.muted}>{nudgeCopy.breakfast[0][1]}</T>
        <T size={12}>
          Watch and step messages use actual readings, not invented activity.
          Already logged manually? Matching watch sessions do not prompt you
          again.
        </T>
      </Card>
      {!!message && <Banner text={message} />}{" "}
      {!!error && <Banner error text={error} />}
      <Button
        title="Save smart nudges"
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          void state
            .save(draft)
            .then(() => {
              setMessage(
                draft.enabled
                  ? "Smart nudges enabled. Meal checks and celebrations follow your saved choices."
                  : "Smart nudges paused.",
              );
              return inspect();
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
    </Page>
  );
}
