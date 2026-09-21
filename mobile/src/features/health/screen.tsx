import { router } from "expo-router";
import { energyForDay } from "../fitness/domain";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Banner, Button, C, Card, Field, Icon, Page, S, T } from "../ui";
import { useHealth } from "./store";
import * as adapter from "./adapter";
import { useTracker, totalNutrition } from "../tracker";
import { useAuthStore } from "../../store/authStore";
import api, { errorMessage } from "../../lib/api";
import { DatePicker } from "../home";
export default function Health() {
  const s = useHealth(),
    tracker = useTracker(),
    u = useAuthStore((x) => x.user),
    deviceDay = s.days[tracker.date],
    day = {
      ...deviceDay,
      ...energyForDay(tracker.date, tracker.fitness, deviceDay),
    };
  const [move, setMove] = useState(
      u?.settings.move_goal_kcal?.toString() || "",
    ),
    [minutes, setMinutes] = useState(
      u?.settings.exercise_goal_minutes?.toString() || "",
    ),
    [message, setMessage] = useState("");
  const platform = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  useEffect(() => {
    if (s.enabled) void s.readDay(tracker.date);
  }, [tracker.date, s.enabled, s.uid]);
  async function saveGoals() {
    try {
      const goals = {
        move_goal_kcal: move ? Number(move) : null,
        exercise_goal_minutes: minutes ? Number(minutes) : null,
      };
      if (
        (move &&
          (!Number.isInteger(goals.move_goal_kcal) ||
            Number(move) < 50 ||
            Number(move) > 3000)) ||
        (minutes &&
          (!Number.isInteger(goals.exercise_goal_minutes) ||
            Number(minutes) < 5 ||
            Number(minutes) > 300))
      )
        throw new Error(
          "Choose 50–3000 active kcal and 5–300 workout minutes, or leave blank.",
        );
      const { data } = await api.patch("/api/users/me/settings", goals);
      useAuthStore
        .getState()
        .updateUser(
          data.user ? data.user : { settings: { ...u!.settings, ...goals } },
        );
      setMessage(
        "Movement goals saved. These do not increase your food allowance.",
      );
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  const eaten = totalNutrition(
    tracker.entries.filter((e) => e.log_date === tracker.date && !e.deleted_at),
  ).calories;
  return (
    <Page
      back
      eyebrow="FOOD + MOVEMENT"
      title="Eaten. Burned. In view."
      subtitle="Your health readings stay on this device unless you choose to share a summary with Ember."
    >
      <DatePicker />
      <Button title="Log activity" onPress={() => router.push("/activity")} />
      <Card>
        <T bold size={22}>
          {Platform.OS === "web" ? "Apple Health + Health Connect" : platform}
        </T>
        <T color={C.muted}>
          {Platform.OS === "ios"
            ? "Your Apple Watch must sync to Apple Health on this iPhone."
            : "Your watch app must write calories and workouts to Health Connect. Steps alone do not mean calorie data is available."}
        </T>
      </Card>
      {s.enabled && s.permissionVersion < 2 && (
        <Banner text="This update adds total burn and workout history. Review and approve the new health permissions below." />
      )}
      <View style={S.two}>
        <Card style={{ flex: 1 }}>
          <T bold size={26}>
            {Math.round(eaten)}
          </T>
          <T color={C.lime}>kcal eaten</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T bold size={26}>
            {day?.totalCalories == null ? "—" : Math.round(day.totalCalories)}
          </T>
          <T color={C.orange}>total kcal burned</T>
        </Card>
      </View>
      <Card>
        {[
          ["Active burn", day?.activeCalories, "kcal"],
          ["Resting burn", day?.restingCalories, "kcal"],
          ["Workout time", day?.exerciseMinutes, "min"],
          ["Steps", day?.steps, "steps"],
        ].map(([label, value, unit]) => (
          <View
            key={String(label)}
            style={[S.row, { justifyContent: "space-between" }]}
          >
            <T>{label}</T>
            <T bold>
              {value == null
                ? "Unavailable"
                : Math.round(Number(value)).toLocaleString() + " " + unit}
            </T>
          </View>
        ))}
        <T color={C.muted} size={12}>
          Total burn includes activity. Only workouts explicitly marked Not
          captured add to watch totals. Today’s readings may cover only part of
          the day.
        </T>
        {deviceDay && (
          <T color={C.muted} size={12}>
            Read {new Date(day.readAt).toLocaleString()} · {day.source}
          </T>
        )}
      </Card>
      {deviceDay?.workouts.map((w) => (
        <Card key={w.id}>
          <T bold>{w.name}</T>
          <T>
            {Math.round(w.minutes)} min ·{" "}
            {new Date(w.start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </T>
          <T size={12} color={C.muted}>
            {w.source}
          </T>
        </Card>
      ))}
      {deviceDay && (
        <Card>
          <T bold>Data access for this day</T>
          {Object.entries(deviceDay!.permissions).map(([metric, status]) => (
            <T key={metric} size={13}>
              {metric}: {status}
            </T>
          ))}
          {deviceDay!.errors.map((e, i) => (
            <T key={i} color={C.orange} size={12}>
              {e}
            </T>
          ))}
        </Card>
      )}
      {s.error && <Banner error text={s.error} />}
      {Platform.OS === "web" ? (
        <Banner text="Connect from the native iPhone or Android app. Health services are not available in this browser preview." />
      ) : (
        <>
          <Button
            title={
              s.enabled
                ? "Review & enable health access"
                : `Connect ${platform}`
            }
            loading={s.busy}
            onPress={() => void s.connect()}
          />
          {s.enabled && (
            <>
              <Button
                secondary
                title="Sync health now"
                loading={s.busy}
                onPress={() => void s.sync()}
              />
              <Button
                secondary
                title={
                  s.importing
                    ? `Importing history · ${s.importProgress}%`
                    : "Import recent 30 days"
                }
                disabled={s.importing}
                onPress={() => void s.importHistory()}
              />
              <Button
                secondary
                title="Allow older history & import year"
                disabled={s.importing}
                onPress={() => void s.importHistory(true)}
              />
              <Button
                secondary
                title="Open health settings"
                onPress={() => void adapter.settings()}
              />
              <Button
                secondary
                title="Disconnect health sync"
                onPress={() => void s.disconnect()}
              />
            </>
          )}
        </>
      )}
      <Card>
        <T bold>Optional movement goals</T>
        <Field
          label="Active kcal goal · optional"
          value={move}
          onChange={setMove}
          numeric
        />
        <Field
          label="Workout minutes goal · optional"
          value={minutes}
          onChange={setMinutes}
          numeric
        />
        <Button title="Save movement goals" onPress={() => void saveGoals()} />
        {!!message && <Banner text={message} />}
      </Card>
      <T color={C.muted} size={12}>
        Read access: steps, active/total or resting energy, workouts and
        available history. Separate write access exports your confirmed
        food/water. A denied write does not block reading activity. Import
        requires the app to stay open; available history depends on device
        permissions and source data. Disconnect stops future sync; cached days
        stay on this device.
      </T>
    </Page>
  );
}
