import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Page, Card, T, C, Button, Segments, Tap, S, Banner } from "../ui";
import { useTracker } from "../tracker";
import { useHealth } from "../health/store";
import { localDateKey } from "../../lib/dates";
import { periodDates, summarize, energyForDay } from "./domain";
import DailyEnergy from "../health/energy";
export default function Calendar() {
  const t = useTracker(),
    h = useHealth(),
    [period, setPeriod] = useState("month"),
    [anchor, setAnchor] = useState(t.date);
  const dates = periodDates(anchor, period as "month" | "year"),
    summary = summarize(dates, t.entries, t.fitness, h.days),
    energy = energyForDay(t.date, t.fitness, h.days[t.date]);
  function move(n: number) {
    const d = new Date(anchor + "T12:00:00");
    d.setDate(1);
    if (period === "year") d.setFullYear(d.getFullYear() + n);
    else d.setMonth(d.getMonth() + n);
    setAnchor(localDateKey(d));
  }
  const monthLabel = new Date(anchor + "T12:00:00").toLocaleDateString(
    undefined,
    period === "year"
      ? { year: "numeric" }
      : { month: "long", year: "numeric" },
  );
  return (
    <Page
      eyebrow="THE BIGGER PICTURE"
      title="Your rhythm."
      subtitle="Food, movement and the days you showed up."
    >
      <Segments
        value={period}
        onChange={setPeriod}
        values={[
          { key: "month", label: "Month" },
          { key: "year", label: "Year" },
        ]}
      />
      <View style={[S.row, { justifyContent: "space-between" }]}>
        <Button secondary title="Previous" onPress={() => move(-1)} />
        <T bold>{monthLabel}</T>
        <Button
          secondary
          title="Next"
          disabled={
            anchor.slice(0, period === "year" ? 4 : 7) >=
            localDateKey().slice(0, period === "year" ? 4 : 7)
          }
          onPress={() => move(1)}
        />
      </View>
      {period === "month" ? (
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <View
                key={"h" + i}
                style={{ width: "14.285%", alignItems: "center", padding: 6 }}
              >
                <T color={C.muted}>{d}</T>
              </View>
            ))}
            {Array.from(
              { length: new Date(dates[0] + "T12:00:00").getDay() },
              (_, i) => (
                <View key={"blank" + i} style={{ width: "14.285%" }} />
              ),
            )}
            {summary.rows.map((r) => (
              <Tap
                key={r.date}
                label={"View " + r.date}
                disabled={r.date > localDateKey()}
                onPress={() => t.setDate(r.date)}
                style={{
                  width: "14.285%",
                  minHeight: 59,
                  padding: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor:
                    r.date === t.date ? C.elevated : "transparent",
                  borderWidth: r.date === t.date ? 1 : 0,
                  borderColor: C.lime,
                }}
              >
                <T bold={r.date === t.date}>{Number(r.date.slice(-2))}</T>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {r.foods > 0 && (
                    <T size={9} color={C.lime}>
                      ●
                    </T>
                  )}
                  {r.activeCalories != null && (
                    <T size={9} color={C.orange}>
                      ●
                    </T>
                  )}
                  {r.workouts.length > 0 && (
                    <T size={9} color={C.blue}>
                      ●
                    </T>
                  )}
                </View>
              </Tap>
            ))}
          </View>
          <T size={11} color={C.muted}>
            Green · food Orange · burn Blue · manual workout. Blank days are
            unrecorded.
          </T>
        </Card>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const prefix =
                anchor.slice(0, 4) + "-" + String(i + 1).padStart(2, "0"),
              rows = summary.rows.filter((r) => r.date.startsWith(prefix));
            return (
              <Tap
                key={prefix}
                label={"Open " + prefix}
                onPress={() => {
                  setAnchor(prefix + "-01");
                  setPeriod("month");
                }}
                style={{
                  width: "31%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: C.card,
                  minHeight: 90,
                }}
              >
                <T bold>
                  {new Date(prefix + "-01T12:00:00").toLocaleDateString(
                    undefined,
                    { month: "short" },
                  )}
                </T>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 3,
                    marginTop: 8,
                  }}
                >
                  {rows.map((r) => (
                    <View
                      key={r.date}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 2,
                        backgroundColor:
                          r.foods && r.activeCalories != null
                            ? C.lime
                            : r.foods
                              ? C.blue
                              : r.activeCalories != null
                                ? C.orange
                                : C.border,
                      }}
                    />
                  ))}
                </View>
              </Tap>
            );
          })}
        </View>
      )}
      <Card>
        <T bold size={20}>
          {period === "year" ? "Year" : "Month"} in motion
        </T>
        <T>
          {Math.round(summary.eaten).toLocaleString()} kcal eaten ·{" "}
          {summary.foodDays} logged days
        </T>
        <T color={C.orange}>
          {summary.burnDays
            ? Math.round(summary.totalBurn).toLocaleString() +
              " kcal total burned"
            : "Total burn unavailable"}{" "}
          · {summary.burnDays} covered days
        </T>
        <T>
          {summary.activeDays
            ? Math.round(summary.activeBurn).toLocaleString() + " active kcal"
            : "Active burn unavailable"}{" "}
          · {Math.round(summary.minutes)} recorded workout minutes
        </T>
        <T size={12} color={C.muted}>
          Totals cover recorded days only. Food logs and device readings may be
          incomplete; these are not a calorie deficit calculation.
        </T>
      </Card>
      <Button
        secondary
        title={"Share this " + period}
        onPress={() =>
          router.push({ pathname: "/share", params: { period, anchor } })
        }
      />
      <Card>
        <T bold>Weight over time</T>
        {summary.weights.length ? (
          summary.weights.map((r) => (
            <T key={r.id}>
              {r.log_date} · {r.weightKg} kg
            </T>
          ))
        ) : (
          <T color={C.muted}>Add dated weigh-ins to see your trend.</T>
        )}
        {summary.weightChange != null && (
          <T color={C.lime}>
            {summary.weightChange > 0 ? "+" : ""}
            {summary.weightChange.toFixed(1)} kg between first and latest
            recorded dates
          </T>
        )}
        <T size={12} color={C.muted}>
          Daily weight fluctuates. Several weeks of records help you and Ember
          assess your direction; a single day cannot predict a goal date.
        </T>
        <Button
          secondary
          title="Log weight"
          onPress={() =>
            router.push({ pathname: "/activity", params: { kind: "weight" } })
          }
        />
      </Card>
      <T bold size={22}>
        {t.date}
      </T>
      <DailyEnergy />
      <Button
        title="Open this day’s diary"
        onPress={() => router.push("/(tabs)/dashboard")}
      />
      <Button
        secondary
        title="Log activity"
        onPress={() => router.push("/activity")}
      />
      {energy.workouts.map((w) => (
        <Card key={w.id}>
          <T bold>{w.name}</T>
          <T>
            {w.minutes} min ·{" "}
            {w.calories == null
              ? "Calories unknown"
              : w.calories + " kcal estimate"}
          </T>
          <T size={12} color={C.muted}>
            {w.energyPolicy === "additional"
              ? "Marked as not captured by watch"
              : w.energyPolicy === "included"
                ? "Included in watch totals"
                : "Auto · watch totals take priority"}
          </T>
          <Button
            secondary
            title={"Edit " + w.name}
            onPress={() =>
              router.push({ pathname: "/activity", params: { id: w.id } })
            }
          />
        </Card>
      ))}
      {(h.days[t.date]?.workouts || []).map((w) => (
        <Card key={w.id}>
          <T bold>{w.name}</T>
          <T>
            {Math.round(w.minutes)} min · {w.source}
          </T>
          <T size={12} color={C.muted}>
            Imported session; its calories are already part of device totals.
          </T>
        </Card>
      ))}
    </Page>
  );
}
