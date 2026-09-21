import { Switch, View } from "react-native";
import { useHealth } from "../health/store";
import { DateTimeField } from "../pickers";
import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useTracker } from "../tracker";
import { Banner, Button, Card, Field, Page, Segments, T, C, Tap } from "../ui";
import { localDateKey } from "../../lib/dates";
export default function ActivityEditor() {
  const t = useTracker(),
    params = useLocalSearchParams<{ id?: string; kind?: string }>(),
    existing = t.fitness.find((r) => r.id === params.id);
  const [kind, setKind] = useState(existing?.kind || params.kind || "workout"),
    [name, setName] = useState(
      existing?.kind === "workout" ? existing.name : "Walking",
    ),
    [date, setDate] = useState(existing?.log_date || t.date),
    [time, setTime] = useState(
      existing?.kind === "workout"
        ? new Date(existing.start).toTimeString().slice(0, 5)
        : "18:00",
    ),
    [minutes, setMinutes] = useState(
      existing?.kind === "workout" ? String(existing.minutes) : "30",
    ),
    [calories, setCalories] = useState(
      existing?.kind === "workout" && existing.calories != null
        ? String(existing.calories)
        : "",
    ),
    [weight, setWeight] = useState(
      existing?.kind === "weight" ? String(existing.weightKg) : "",
    ),
    [policy, setPolicy] = useState(
      existing?.kind === "workout" ? existing.energyPolicy : "auto",
    ),
    [notes, setNotes] = useState(
      existing?.kind === "workout" ? existing.notes : "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const watchDay = useHealth((s) => s.days[date]);
  const hasWatchCalories = watchDay?.activeCalories != null || watchDay?.totalCalories != null;
  const [adjustCalories, setAdjustCalories] = useState(false);
  async function save() {
    setError("");
    setBusy(true);
    try {
      const day = new Date(date + "T12:00:00");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(+day) ||
        localDateKey(day) !== date ||
        date > localDateKey()
      )
        throw Error("Choose a valid date, today or earlier.");
      const base = {
        id: existing?.id || Crypto.randomUUID(),
        version: existing?.version || 1,
        log_date: date,
      };
      if (kind === "weight") {
        if (
          !weight.trim() ||
          !Number.isFinite(+weight) ||
          +weight < 25 ||
          +weight > 400
        )
          throw Error("Enter a weight between 25 and 400 kg.");
        await t.saveFitness({ ...base, kind: "weight", weightKg: +weight });
      } else {
        if (
          !name.trim() ||
          name.length > 80 ||
          !Number.isFinite(+minutes) ||
          +minutes <= 0 ||
          +minutes > 1440
        )
          throw Error(
            "Add an activity name and duration between 1 and 1440 minutes.",
          );
        if (
          calories.trim() &&
          (!Number.isFinite(+calories) || +calories < 0 || +calories > 10000)
        )
          throw Error("Enter calories between 0 and 10,000, or leave blank.");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
          throw Error("Use a valid 24-hour time, such as 18:30.");
        await t.saveFitness({
          ...base,
          kind: "workout",
          name: name.trim(),
          start: new Date(date + "T" + time + ":00").toISOString(),
          minutes: +minutes,
          calories: calories.trim() ? +calories : null,
          energyPolicy: policy as any,
          notes,
        });
      }
      t.setDate(date);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      title={existing ? "Edit your record" : kind === "weight" ? "Log your weight" : "Log your activity"}
      subtitle={kind === "weight" ? "A small check-in on your progress." : "Add an activity you did. Watch workouts sync separately."}
    >
      {!existing && (
        <Segments
          value={kind}
          onChange={setKind}
          values={[
            { key: "workout", label: "Activity" },
            { key: "weight", label: "Weight" },
          ]}
        />
      )}
      <DateTimeField
        label="Activity date"
        mode="date"
        value={date}
        onChange={setDate}
        maximumDate={new Date()}
      />
      {kind === "weight" ? (
        <Field
          label="Weight · kg"
          value={weight}
          onChange={setWeight}
          keyboard="decimal-pad"
        />
      ) : (
        <>
          <Field label="Activity name" value={name} onChange={setName} />
          <Segments
            value={name}
            onChange={setName}
            values={["Walking", "Running", "Cycling", "Strength"].map((x) => ({
              key: x,
              label: x,
            }))}
          />
          <DateTimeField
            label="Start time"
            mode="time"
            value={time}
            onChange={setTime}
          />
          <Field
            label="Duration · minutes"
            value={minutes}
            onChange={setMinutes}
            keyboard="decimal-pad"
          />
          <Field
            label="Active calories · optional"
            value={calories}
            onChange={setCalories}
            keyboard="decimal-pad"
          />
          <T color={C.muted} size={12}>
            Leave calories blank if you don’t know them. Your activity and minutes will still be saved.
          </T>
          {(hasWatchCalories || policy !== "auto") && (
            <>
              <Tap label={adjustCalories ? "Hide calorie adjustment" : "Adjust calorie counting"} onPress={() => setAdjustCalories(!adjustCalories)} style={{paddingVertical: 8}}><T color={C.muted} size={13}>{adjustCalories ? "Hide calorie adjustment" : "Adjust calorie counting"}</T></Tap>
              {adjustCalories && <Card>
                <T bold>{hasWatchCalories ? "Your watch already reports calories for this day." : "How this activity affects your calories"}</T>
                <T color={C.muted} size={12}>We use that total so the same activity isn’t counted twice. Turn this on only if you did this activity without your watch.</T>
                <View style={{flexDirection: "row", alignItems: "center", gap: 12}}>
                  <View style={{flex: 1}}><T>Add these calories to my watch total</T></View>
                  <Switch accessibilityLabel="Add these calories to my watch total" value={policy === "additional"} onValueChange={(v) => setPolicy(v ? "additional" : "auto")} />
                </View>
              </Card>}
            </>
          )}
          <Field label="Notes · optional" value={notes} onChange={setNotes} />
        </>
      )}
      {!!error && <Banner error text={error} />}
      <Button title="Save record" loading={busy} onPress={() => void save()} />
      {existing && (
        <Button
          danger
          title="Delete record"
          onPress={() =>
            void t.deleteFitness(existing.id).then(() => router.back())
          }
        />
      )}
    </Page>
  );
}
