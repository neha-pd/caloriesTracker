import { energyForDay } from "../fitness/domain";
import React, { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import { useHealth } from "./store";
import { useTracker, totalNutrition } from "../tracker";
import { useAuthStore } from "../../store/authStore";
import { localDateKey } from "../../lib/dates";
import { Card, T, C, S, Button, Meter } from "../ui";
export default function DailyEnergy() {
  const health = useHealth(),
    tracker = useTracker(),
    u = useAuthStore((s) => s.user),
    day = health.days[tracker.date],
    energy = energyForDay(tracker.date, tracker.fitness, day);
  useEffect(() => {
    if (health.enabled) void health.readDay(tracker.date);
  }, [tracker.date, health.enabled, health.uid]);
  const eaten = totalNutrition(
    tracker.entries.filter((e) => e.log_date === tracker.date && !e.deleted_at),
  ).calories;
  const metrics = [
    {
      label: "Eaten",
      value: eaten,
      goal: u?.calorie_goal || 2000,
      unit: "kcal",
      color: C.lime,
    },
    {
      label: "Active burn",
      value: energy.activeCalories ?? null,
      goal: u?.settings.move_goal_kcal,
      unit: "kcal",
      color: C.orange,
    },
    {
      label: "Workout",
      value: energy.exerciseMinutes ?? null,
      goal: u?.settings.exercise_goal_minutes,
      unit: "min",
      color: C.blue,
    },
  ];
  return (
    <View testID="daily-energy">
      <Card>
        <T bold size={20}>
          Your day, together.
        </T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {metrics.map((m) => (
            <View
              key={m.label}
              style={{ flex: 1, alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 90,
                  height: 90,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg width={90} height={90} style={{ position: "absolute" }}>
                  <Circle
                    cx={45}
                    cy={45}
                    r={38}
                    fill="none"
                    stroke={C.border}
                    strokeWidth={7}
                  />
                  {m.goal && m.value != null ? (
                    <Circle
                      cx={45}
                      cy={45}
                      r={38}
                      fill="none"
                      stroke={m.color}
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(1, m.value / m.goal) * 239} 239`}
                      rotation={-90}
                      origin="45,45"
                    />
                  ) : null}
                </Svg>
                <T bold size={18} color={m.color}>
                  {m.value == null ? "—" : Math.round(m.value).toLocaleString()}
                </T>
                <T size={10} color={C.muted}>
                  {m.unit}
                </T>
              </View>
              <T bold size={12}>
                {m.label}
              </T>
              <T size={10} color={C.muted}>
                {m.value == null
                  ? "Not recorded"
                  : m.goal
                    ? `of ${m.goal}`
                    : "Goal optional"}
              </T>
            </View>
          ))}
        </View>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <T>Total burned{tracker.date === localDateKey() ? " so far" : ""}</T>
          <T bold color={C.orange}>
            {energy.totalCalories == null
              ? "Unavailable"
              : Math.round(energy.totalCalories!).toLocaleString() + " kcal"}
          </T>
        </View>
        <T size={12} color={C.muted}>
          {energy.totalCalories != null
            ? "Total includes activity. Only workouts marked Not captured add to watch totals."
            : "Active burn is movement only. Total burn also needs resting energy; steps alone do not supply it."}
        </T>
        {day && (
          <T size={11} color={C.muted}>
            {day.source} · read {new Date(day.readAt).toLocaleString()} · device
            estimates may be incomplete.
          </T>
        )}
        <View style={{ gap: 8 }} testID="step-progress">
          <T bold>
            {day?.steps == null
              ? "Your step story starts here"
              : `${Math.round(day.steps).toLocaleString()} steps`}
          </T>
          {u?.settings.step_goal ? (
            <>
              <Meter
                value={
                  day?.steps == null
                    ? 0
                    : Math.min(100, (day.steps / u.settings.step_goal) * 100)
                }
              />
              <T size={12} color={C.blue}>
                {day?.steps == null
                  ? "Waiting for a device reading"
                  : day.steps >= u.settings.step_goal
                    ? "Hooray! Your chosen step goal is complete 🎉"
                    : `${Math.max(0, u.settings.step_goal - Math.round(day.steps)).toLocaleString()} to your goal`}{" "}
                · chosen goal {u.settings.step_goal.toLocaleString()}
              </T>
            </>
          ) : (
            <Button
              secondary
              title="Choose my step goal"
              onPress={() => router.push("/health")}
            />
          )}
        </View>
        <Button
          secondary
          title="Activity & burn details"
          onPress={() => router.push("/health")}
        />
      </Card>
    </View>
  );
}
