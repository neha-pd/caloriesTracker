import React, { useEffect, useRef, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import { Art, Banner, Button, C, Card, Meter, Page, S, T } from "../ui";
import { DatePicker } from "../home";
import {
  coachPrompt,
  dayContext,
  parseTipIds,
  tips,
  type TipId,
} from "./domain";
import { useLocalCoach } from "./localModel";
export default function Coach() {
  const s = useTracker(),
    u = useAuthStore((x) => x.user),
    focused = useIsFocused(),
    model = useLocalCoach(focused);
  const [complete, setComplete] = useState(false),
    [selected, setSelected] = useState<TipId[]>([]),
    [savedFingerprint, setSavedFingerprint] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = useRef(0);
  const context = dayContext({
      date: s.date,
      entries: s.entries,
      water: s.water,
      complete,
      goals: {
        calories: u?.calorie_goal || 2000,
        protein: u?.protein_goal_g || 100,
        carbs: u?.carbs_goal_g || 250,
        fat: u?.fat_goal_g || 67,
        water: u?.settings.water_goal_ml || 2000,
      },
    }),
    fingerprint = JSON.stringify(context);
  const current = useRef(fingerprint);
  current.current = fingerprint;
  useEffect(() => {
    run.current++;
    setComplete(false);
    setSelected([]);
    setSavedFingerprint("");
    setBusy(false);
    setError("");
    const id = run.current;
    if (u?.id)
      void AsyncStorage.getItem(`fitlens:coach:${u.id}:${s.date}`).then(
        (raw) => {
          if (id !== run.current || !raw) return;
          try {
            const cached = JSON.parse(raw);
            setComplete(!!cached.complete);
            setSelected(cached.ids.filter((v: string) => v in tips));
            setSavedFingerprint(cached.fingerprint);
          } catch {}
        },
      );
  }, [u?.id, s.date]);
  useEffect(() => {
    if (!focused) {
      run.current++;
      setBusy(false);
      model.stop();
    }
  }, [focused]);
  async function review() {
    const request = ++run.current;
    setBusy(true);
    setError("");
    try {
      const ids = parseTipIds(
        await model.generate(coachPrompt(context)),
        context.allowedTips,
      );
      if (request !== run.current || current.current !== fingerprint) return;
      setSelected(ids);
      setSavedFingerprint(fingerprint);
      await AsyncStorage.setItem(
        `fitlens:coach:${u!.id}:${s.date}`,
        JSON.stringify({
          ids,
          complete,
          fingerprint,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch (e) {
      if (request === run.current)
        setError(e instanceof Error ? e.message : "Could not review your day.");
    } finally {
      if (request === run.current) setBusy(false);
    }
  }
  const fresh = savedFingerprint === fingerprint;
  return (
    <Page
      back
      eyebrow="EMBER · YOUR DAILY COACH"
      title="A moment to reflect."
      subtitle="A grounded look at what you logged, with gentle ideas for your routine."
    >
      <Button
        title="Talk to Ember · voice & chat"
        icon="chatbubble-ellipses-outline"
        onPress={() => router.push("/chat")}
      />
      <DatePicker />
      <Card>
        <T bold size={22}>
          {context.foodEntries
            ? `${context.foodEntries} foods remembered`
            : "Your day is still a fresh page"}
        </T>
        <T color={C.muted}>
          {Math.round(context.totals.calories)} kcal logged · target{" "}
          {context.chosenTargets.calories} kcal
        </T>
        <T color={C.muted}>
          {context.waterMl} ml water logged · target{" "}
          {context.chosenTargets.water} ml
        </T>
        <T color={C.muted} size={13}>
          Protein {Math.round(context.totals.protein)} /{" "}
          {context.chosenTargets.protein} g · Carbs{" "}
          {Math.round(context.totals.carbs)} / {context.chosenTargets.carbs} g ·
          Fat {Math.round(context.totals.fat)} / {context.chosenTargets.fat} g
        </T>
        <View style={S.row}>
          <View style={{ flex: 1 }}>
            <T bold size={13}>
              I’ve logged my whole day
            </T>
            <T size={12} color={C.muted}>
              Otherwise this is a partial-day review.
            </T>
          </View>
          <Switch
            accessibilityLabel="I have logged my whole day"
            value={complete}
            onValueChange={setComplete}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </View>
      </Card>
      <Banner
        text={
          complete
            ? "A completed log is still an estimate. One day is not a judgment of your health."
            : "This is a partial log. Missing entries do not tell us what you did or did not eat."
        }
      />
      {!model.enabled ? (
        <Card>
          <Art size={95} />
          <T bold>Use your private local coach</T>
          <T color={C.muted}>
            Your conversation model can review your day. Your diary stays on
            this device during the review.
          </T>
          <Button
            title={
              Platform.OS === "web" ? "About on-device AI" : "Set up local AI"
            }
            onPress={() => router.push({ pathname: "/chat" })}
          />
        </Card>
      ) : !model.ready ? (
        <Card>
          <T bold>
            {model.error
              ? "Local model needs attention"
              : `Preparing your coach · ${Math.round(model.progress)}%`}
          </T>
          <Meter value={model.progress} />
          {model.error && <Banner error text={model.error.message} />}
          <Button
            secondary
            title="Manage local AI"
            onPress={() => router.push({ pathname: "/chat" })}
          />
        </Card>
      ) : (
        <Button
          title={busy ? "Reflecting on your day…" : "Review my day privately"}
          loading={busy}
          testID="coach-review"
          onPress={() => void review()}
        />
      )}
      {busy && (
        <Button
          secondary
          title="Stop review"
          onPress={() => {
            run.current++;
            model.stop();
            setBusy(false);
          }}
        />
      )}
      {error && <Banner error text={error} />}
      {selected.length > 0 && !fresh && (
        <Banner text="Your log changed. Refresh the review for suggestions based on the latest entries." />
      )}
      <T bold size={19}>
        {fresh && selected.length
          ? "Your local coach’s priorities"
          : "A few gentle ideas"}
      </T>
      {(fresh && selected.length
        ? selected
        : context.allowedTips.slice(0, 3)
      ).map((id) => (
        <Card key={id}>
          <T bold size={18}>
            {tips[id].title}
          </T>
          <T color={C.muted}>{tips[id].body}</T>
          <Button
            secondary
            title="Make this a reminder"
            onPress={() =>
              router.push({
                pathname: "/reminder-editor",
                params: {
                  title: tips[id].title,
                  body: tips[id].reminder,
                  hour: String(tips[id].hour),
                },
              })
            }
          />
        </Card>
      ))}
      <T size={12} color={C.muted}>
        {fresh && selected.length
          ? "LFM prioritized these suggestions from your logged data."
          : "These are built-in suggestions; no AI review has been generated for this log."}{" "}
        The coach does not change targets, diagnose conditions, or reward eating
        less.
      </T>
      <Button
        secondary
        title="Create a custom reminder"
        onPress={() => router.push("/reminder-editor")}
      />
      <Button
        secondary
        title="Share my coach report"
        onPress={() =>
          router.push({ pathname: "/share", params: { mode: "report" } })
        }
      />
    </Page>
  );
}
