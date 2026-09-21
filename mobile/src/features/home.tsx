import { DateTimeField } from "./pickers";
import DailyEnergy from "./health/energy";
import { GuidePrompt } from "./guide";
import { useHealth } from "./health/store";
import React, { useState } from "react";
import { View, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Empty,
  Field,
  Icon,
  Meter,
  Page,
  RowLink,
  S,
  Section,
  Segments,
  T,
  Tap,
} from "./ui";
import { useTracker, totalNutrition } from "./tracker";
import { useAuthStore } from "../store/authStore";
import { localDateKey } from "../lib/dates";
export function DatePicker() {
  const date = useTracker((s) => s.date);
  function move(n: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + n);
    useTracker.getState().setDate(localDateKey(d));
  }
  return (
    <View style={[S.row, { justifyContent: "space-between" }]}>
      <Tap label="Previous day" onPress={() => move(-1)} style={S.round}>
        <Icon name="chevron-back" />
      </Tap>
      <DateTimeField
        label="Choose diary date"
        mode="date"
        value={date}
        onChange={(d) => useTracker.getState().setDate(d)}
        maximumDate={new Date()}
        compact
      />
      <Tap
        label="Next day"
        disabled={date >= localDateKey()}
        onPress={() => move(1)}
        style={S.round}
      >
        <Icon name="chevron-forward" />
      </Tap>
    </View>
  );
}
export function SyncBanner() {
  const s = useTracker();
  return (
    <>
      {s.error && (
        <Banner
          text={
            s.queue.length
              ? `${s.queue.length} changes saved on this device. ${s.error}`
              : s.error
          }
          error
        />
      )}
      {s.notice && (
        <Tap
          label="Dismiss update"
          onPress={() => useTracker.setState({ notice: null })}
        >
          <Banner text={s.notice} />
        </Tap>
      )}
    </>
  );
}
export function Macros({ compact = false }: { compact?: boolean }) {
  const s = useTracker(),
    u = useAuthStore((x) => x.user);
  const t = totalNutrition(
    s.entries.filter((e) => e.log_date === s.date && !e.deleted_at),
  );
  return (
    <View style={{ gap: 14 }}>
      {[
        {
          name: "Protein",
          value: t.protein_g,
          goal: u?.protein_goal_g || 100,
          color: C.orange,
        },
        {
          name: "Carbs",
          value: t.carbs_g,
          goal: u?.carbs_goal_g || 250,
          color: C.blue,
        },
        {
          name: "Fat",
          value: t.fat_g,
          goal: u?.fat_goal_g || 67,
          color: C.purple,
        },
      ].map((m) => (
        <View key={m.name} style={{ gap: 9 }}>
          <View style={[S.row, { justifyContent: "space-between" }]}>
            <T color={m.color} bold={compact}>
              {m.name}
            </T>
            <T size={13}>
              {Math.round(m.value)}{" "}
              <T color={C.muted} size={12}>
                / {m.goal} g
              </T>
            </T>
          </View>
          <Meter
            value={m.goal ? (m.value / m.goal) * 100 : 0}
            color={m.color}
          />
        </View>
      ))}
    </View>
  );
}
export function Dashboard() {
  const health = useHealth();
  const s = useTracker(),
    u = useAuthStore((x) => x.user);
  const entries = s.entries.filter(
      (e) => e.log_date === s.date && !e.deleted_at,
    ),
    t = totalNutrition(entries),
    water = s.water
      .filter((w) => w.log_date === s.date && !w.deleted_at)
      .reduce((a, w) => a + w.amount_ml, 0),
    goal = u?.calorie_goal || 2000;
  const pct = Math.min(1, t.calories / goal);
  return (
    <Page
      eyebrow={`HEY, ${u?.display_name?.split(" ")[0] || "FRIEND"}`}
      title={"Make today\na little brighter."}
      right={
        <Tap
          label="View streak"
          onPress={() => router.push("/streak")}
          style={[S.round, { width: 66 }]}
        >
          <T bold color={C.orange}>
            ♨ {s.progress.streak}
          </T>
        </Tap>
      }
      refresh={{ loading: s.syncing, run: s.sync }}
      testID="dashboard"
    >
      {u?.id === "fitlens-offline-demo" && (
        <Banner text="DEMO · 45 days of fictional sample data, stored only on this device." />
      )}
      <DatePicker />
      <DailyEnergy />
      <Button
        secondary
        title="Log activity"
        icon="fitness-outline"
        onPress={() => router.push("/activity")}
      />
      <Card style={{ backgroundColor: C.elevated }}>
        <View style={S.row}>
          <Icon name="watch-outline" color={C.lime} />
          <View style={{ flex: 1 }}>
            <T bold>
              {health.enabled
                ? "Health connection enabled"
                : "Connect your device"}
            </T>
            <T size={12} color={C.muted}>
              {Platform.OS === "ios" ? "Apple Health" : "Health Connect"} ·
              steps and activity in one place
            </T>
          </View>
        </View>
        <Button
          title={
            health.enabled
              ? health.permissionVersion < 2
                ? "Enable burn & workout access"
                : "Device & sync settings"
              : "Connect device"
          }
          secondary
          loading={health.busy}
          onPress={() =>
            (health.enabled && health.permissionVersion >= 2) ||
            Platform.OS === "web"
              ? router.push("/watch-settings")
              : void health.connect()
          }
          testID="home-connect-device"
        />
        {health.error && <Banner error text={health.error} />}
      </Card>
      <GuidePrompt />
      <View style={S.two}>
        <View style={{ flex: 1 }}>
          <Button
            title="Add food"
            icon="add"
            onPress={() => router.push("/log")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Chat with Ember"
            icon="chatbubble-outline"
            secondary
            onPress={() => router.push("/chat")}
            testID="talk-ember"
          />
        </View>
      </View>
      <Button
        title="Share my day"
        icon="share-outline"
        secondary
        onPress={() => router.push("/share")}
        testID="share-day"
      />
      <SyncBanner />
      <Card>
        <T bold size={18}>
          Food & macros
        </T>
        <T color={C.muted}>
          {Math.round(t.calories)} of {goal.toLocaleString()} kcal eaten
        </T>
        <Macros compact />
      </Card>
      <View style={S.two}>
        <Card style={{ flex: 1 }} onPress={() => router.push("/water")}>
          <Icon name="water-outline" color={C.blue} />
          <T bold size={23}>
            {(water / 1000).toFixed(1)} <T color={C.muted}>L</T>
          </T>
          <T size={12} color={C.muted}>
            of {(u?.settings.water_goal_ml || 2000) / 1000} L today
          </T>
          <Meter
            value={(water / (u?.settings.water_goal_ml || 2000)) * 100}
            color={C.blue}
          />
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push("/(tabs)/quests")}>
          <Icon name="sparkles-outline" color={C.orange} />
          <T bold size={23}>
            Level {s.progress.level}
          </T>
          <T size={12} color={C.muted}>
            {s.progress.xp} lifetime XP
          </T>
          <Meter value={(s.progress.progress / 250) * 100} color={C.orange} />
        </Card>
      </View>
      <Card onPress={() => router.push("/(tabs)/quests")}>
        <View style={S.row}>
          <Art size={85} />
          <View style={{ flex: 1 }}>
            <T bold size={18}>
              Keep your spark alive.
            </T>
            <T color={C.muted} size={13}>
              A check-in counts. So does showing up again.
            </T>
          </View>
        </View>
      </Card>
      <Section
        title="On the menu"
        action="Full diary"
        onPress={() => router.push("/diary")}
      />
      {entries.length ? (
        entries.slice(-3).map((e) => (
          <Card
            key={e.id}
            onPress={() =>
              router.push({ pathname: "/entry/[id]", params: { id: e.id } })
            }
          >
            <View style={S.row}>
              <Icon name="restaurant-outline" />
              <View style={{ flex: 1 }}>
                <T bold>{e.name}</T>
                <T color={C.muted} size={12}>
                  {e.meal_type} · {Math.round(e.calories)} kcal
                </T>
              </View>
              <Icon name="chevron-forward" size={16} />
            </View>
          </Card>
        ))
      ) : (
        <Empty
          title="Your first little win"
          body="Give your day a starting point. Add something you enjoyed eating."
          action="Log a meal"
          onPress={() => router.push("/log")}
        />
      )}
    </Page>
  );
}
export function Diary() {
  const s = useTracker();
  const es = s.entries.filter((e) => e.log_date === s.date && !e.deleted_at);
  return (
    <Page back eyebrow="A LITTLE AWARENESS" title="Your food story.">
      <DatePicker />
      <SyncBanner />
      {["breakfast", "lunch", "dinner", "snack"].map((meal) => (
        <Card key={meal}>
          <View style={[S.row, { justifyContent: "space-between" }]}>
            <T bold size={20} style={{ textTransform: "capitalize" }}>
              {meal}
            </T>
            <T color={C.muted} size={13}>
              {Math.round(
                es
                  .filter((e) => e.meal_type === meal)
                  .reduce((a, e) => a + e.calories, 0),
              )}{" "}
              kcal
            </T>
          </View>
          {es
            .filter((e) => e.meal_type === meal)
            .map((e) => (
              <RowLink
                key={e.id}
                title={e.name}
                subtitle={`${e.quantity} × ${e.serving_unit} · ${Math.round(e.calories)} kcal`}
                onPress={() =>
                  router.push({ pathname: "/entry/[id]", params: { id: e.id } })
                }
              />
            ))}
          <Button
            secondary
            title={`Add ${meal}`}
            onPress={() => router.push({ pathname: "/log", params: { meal } })}
          />
        </Card>
      ))}
    </Page>
  );
}
export function WaterScreen() {
  const s = useTracker(),
    u = useAuthStore((x) => x.user),
    [amount, setAmount] = useState("250"),
    [error, setError] = useState("");
  const ws = s.water.filter((w) => w.log_date === s.date && !w.deleted_at),
    total = ws.reduce((a, w) => a + w.amount_ml, 0),
    goal = u?.settings.water_goal_ml || 2000;
  async function add(ml: number) {
    if (!Number.isInteger(ml) || ml < 1 || ml > 5000) {
      setError("Choose an amount between 1 and 5,000 ml.");
      return;
    }
    setError("");
    await s.addWater(ml);
  }
  return (
    <Page back eyebrow="A MOMENT TO REFRESH" title="Sip. Reset. Repeat.">
      <DatePicker />
      <SyncBanner />
      <Card
        style={{
          alignItems: "center",
          backgroundColor: "#192a30",
          paddingVertical: 34,
        }}
      >
        <Icon name="water" color={C.blue} size={80} />
        <T bold size={44}>
          {total.toLocaleString()}{" "}
          <T size={19} color={C.blue}>
            ml
          </T>
        </T>
        <T color={C.muted}>of {goal.toLocaleString()} ml daily target</T>
        <View style={{ width: "100%", marginTop: 15 }}>
          <Meter value={(total / goal) * 100} color={C.blue} />
        </View>
      </Card>
      <View style={S.two}>
        {[150, 250, 500].map((n) => (
          <View key={n} style={{ flex: 1 }}>
            <Button
              secondary
              title={`+ ${n} ml`}
              onPress={() => void add(n)}
              testID={`water-${n}`}
            />
          </View>
        ))}
      </View>
      <Card>
        <Field
          label="Custom amount · ml"
          value={amount}
          onChange={setAmount}
          numeric
        />
        {error && <Banner error text={error} />}
        <Button title="Add water" onPress={() => void add(Number(amount))} />
      </Card>
      <Section title="Today’s sips" />
      {ws.length ? (
        ws.map((w) => (
          <Card key={w.id}>
            <View style={S.row}>
              <Icon name="water-outline" color={C.blue} />
              <View style={{ flex: 1 }}>
                <T bold>{w.amount_ml} ml</T>
                <T size={12} color={C.muted}>
                  {new Date(w.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </T>
              </View>
              <Tap
                label={`Remove ${w.amount_ml} ml`}
                onPress={() => void s.deleteWater(w.id)}
                style={S.round}
              >
                <Icon name="close" color={C.muted} />
              </Tap>
            </View>
          </Card>
        ))
      ) : (
        <T color={C.muted}>Your first sip is a fresh start.</T>
      )}
    </Page>
  );
}
export function History() {
  const s = useTracker(),
    [range, setRange] = useState("7");
  const n = Number(range);
  const days = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - n + 1 + i);
    const date = localDateKey(d),
      es = s.entries.filter((e) => e.log_date === date && !e.deleted_at);
    return { date, entries: es.length, ...totalNutrition(es) };
  });
  const logged = days.filter((d) => d.entries),
    avg = logged.length
      ? Math.round(logged.reduce((a, d) => a + d.calories, 0) / logged.length)
      : 0,
    max = Math.max(...days.map((d) => d.calories), 1);
  return (
    <Page
      eyebrow="PROGRESS, YOUR WAY"
      title={"See your\nlittle wins add up."}
      refresh={{ loading: s.syncing, run: s.sync }}
    >
      <Segments
        values={[
          { key: "7", label: "7 days" },
          { key: "30", label: "30 days" },
          { key: "90", label: "90 days" },
        ]}
        value={range}
        onChange={setRange}
      />
      <SyncBanner />
      <Card>
        <T color={C.muted}>Average energy · days logged</T>
        <T bold size={38}>
          {avg.toLocaleString()}{" "}
          <T size={16} color={C.muted}>
            kcal
          </T>
        </T>
        <View
          style={{
            height: 140,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: n > 30 ? 2 : 5,
            marginTop: 16,
          }}
        >
          {days.map((d) => (
            <Tap
              key={d.date}
              label={`${d.date}: ${Math.round(d.calories)} kcal`}
              onPress={() => {
                s.setDate(d.date);
                router.push("/diary");
              }}
              style={{
                flex: 1,
                height: Math.max(4, (d.calories / max) * 140),
                backgroundColor: d.entries ? C.lime : C.border,
                borderRadius: 4,
              }}
            >
              <View />
            </Tap>
          ))}
        </View>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <T size={11} color={C.muted}>
            {days[0].date.slice(5)}
          </T>
          <T size={11} color={C.muted}>
            Today
          </T>
        </View>
      </Card>
      <View style={S.two}>
        <Card style={{ flex: 1 }}>
          <T bold size={29}>
            {logged.length}/{n}
          </T>
          <T color={C.muted} size={13}>
            Days with a meal
          </T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T bold size={29}>
            {s.progress.streak}
          </T>
          <T color={C.muted} size={13}>
            Day activity streak
          </T>
        </Card>
      </View>
      <Card>
        <T bold size={19}>
          A record, not a report card.
        </T>
        <T color={C.muted}>
          These charts reflect what you logged. Missing days are not
          zero-calorie days and are excluded from averages.
        </T>
      </Card>
      <Section title="Recent days" />
      {logged.length ? (
        logged
          .slice()
          .reverse()
          .slice(0, 14)
          .map((d) => (
            <RowLink
              key={d.date}
              title={new Date(d.date + "T12:00:00").toLocaleDateString(
                undefined,
                { weekday: "long", month: "short", day: "numeric" },
              )}
              subtitle={`${d.entries} entries · ${Math.round(d.calories)} kcal`}
              icon="calendar-outline"
              onPress={() => {
                s.setDate(d.date);
                router.push("/diary");
              }}
            />
          ))
      ) : (
        <Empty
          title="Your story starts here"
          body="Log your first meal to start spotting your everyday patterns."
          action="Add a meal"
          onPress={() => router.push("/log")}
        />
      )}
    </Page>
  );
}
export function Quests() {
  const s = useTracker();
  return (
    <Page eyebrow="THE LITTLE WINS CLUB" title={"Good habits.\nGreat company."}>
      <SyncBanner />
      <Card style={{ backgroundColor: "#30261c", borderColor: "#6a4930" }}>
        <Art size={170} />
        <T bold size={25}>
          Ember · Level {s.progress.level}
        </T>
        <T color={C.orange}>
          {s.progress.xp} lifetime XP · {250 - s.progress.progress} to your next
          level
        </T>
        <Meter value={(s.progress.progress / 250) * 100} color={C.orange} />
      </Card>
      <Section title="Daily quests" />
      <Card>
        <T bold size={19}>
          Show up for yourself
        </T>
        <T color={C.muted}>Take a breath and check in. +10 XP, once per day.</T>
        <Button
          title="Check in · +10 XP"
          onPress={() => void s.checkIn()}
          testID="quest-checkin"
        />
      </Card>
      <Card>
        <T bold size={19}>
          Make a little note
        </T>
        <T color={C.muted}>
          Add food today: +10 XP for each new entry (first 20 daily), plus +25
          XP for the first entry in each meal category. Edits and retries earn
          no extra XP.
        </T>
        <Button
          secondary
          title="Log a meal"
          onPress={() => router.push("/log")}
        />
      </Card>
      <Card>
        <T bold size={19}>
          A refreshing pause
        </T>
        <T color={C.muted}>Log a sip of water. +15 XP, once per day.</T>
        <Button
          secondary
          title="Add water"
          onPress={() => router.push("/water")}
        />
      </Card>
      <Section
        title="Your collection"
        action="All badges"
        onPress={() => router.push("/achievements")}
      />
      <View style={S.two}>
        <Art kind="badge" size={110} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <T bold size={21}>
            {s.progress.badges.filter((b) => b.unlocked).length} badges unlocked
          </T>
          <T color={C.muted}>Every one tells a little story.</T>
        </View>
      </View>
    </Page>
  );
}
export function Achievements() {
  const p = useTracker((s) => s.progress);
  return (
    <Page
      back
      eyebrow="COLLECT YOUR LITTLE WINS"
      title={"A shelf of\nsmall victories."}
    >
      <Art kind="badge" size={180} />
      {p.badges.map((b) => (
        <Card key={b.id} style={{ opacity: b.unlocked ? 1 : 0.55 }}>
          <View style={S.row}>
            <Icon
              name={b.unlocked ? "ribbon" : "lock-closed-outline"}
              color={b.unlocked ? C.lime : C.muted}
            />
            <View style={{ flex: 1 }}>
              <T bold size={18}>
                {b.name}
              </T>
              <T size={13} color={C.muted}>
                {b.description}
              </T>
              <T size={11} color={b.unlocked ? C.lime : C.muted}>
                {b.unlocked ? "UNLOCKED" : "KEEP GROWING"}
              </T>
            </View>
          </View>
        </Card>
      ))}
    </Page>
  );
}
export function Streak() {
  const p = useTracker((s) => s.progress);
  return (
    <Page back eyebrow="ONE DAY AT A TIME" title="Keep the fire warm.">
      <Art size={200} />
      <T size={56} bold color={C.orange} style={{ textAlign: "center" }}>
        {p.streak}
      </T>
      <T style={{ textAlign: "center" }}>
        {p.streak === 1 ? "day" : "days"} of showing up
      </T>
      <Card>
        <T bold>Any little win counts.</T>
        <T color={C.muted}>
          A check-in, a meal, or water keeps your activity streak going.
          Yesterday’s streak stays alive while you have today to show up.
        </T>
      </Card>
      <Button
        title="Visit daily quests"
        onPress={() => router.push("/(tabs)/quests")}
      />
    </Page>
  );
}
export function MacroScreen() {
  return (
    <Page back eyebrow="YOUR DAILY MIX" title="More than a number.">
      <DatePicker />
      <Card>
        <Macros />
      </Card>
      <T color={C.muted}>
        Nutrition totals come from your confirmed food entries and portions.
      </T>
      <Button title="Open food diary" onPress={() => router.push("/diary")} />
    </Page>
  );
}
