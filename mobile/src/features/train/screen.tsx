import React, { useEffect, useRef, useState } from "react";
import { View, Platform, AppState, ScrollView, Modal } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import {
  Page,
  T,
  Card,
  Button,
  Tap,
  Field,
  C,
  S,
  Icon,
  Banner,
  Meter,
} from "../ui";
import { DateTimeField } from "../pickers";
import {
  catalog,
  Exercise,
  Profile,
  Plan,
  languages,
  Language,
  initialProfile,
  dayNames,
  generatePlans,
  validateProfile,
  getExercise,
  estimateMinutes,
  createSession,
  volume,
  completedSets,
  weekStats,
  progression,
  calendarFile,
} from "./domain";
import { useTrain } from "./useTrain";
import { loadInstructions } from "./library";
import {
  enableReminders,
  disableReminders,
  restAlert,
  syncCompletion,
  downloadFile,
} from "./notifications";
import { localDateKey } from "../../lib/dates";
const goals = [
  ["habit", "Build a habit"],
  ["strength", "Get stronger"],
  ["muscle", "Build muscle"],
  ["fitness", "Move more"],
];
function Choices({
  items,
  value,
  onChange,
  multiple = false,
  compact = false,
}: {
  items: string[][];
  value: string | string[];
  onChange: (v: string) => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: compact ? "nowrap" : "wrap",
        gap: compact ? 5 : 8,
      }}
    >
      {items.map(([id, label]) => {
        const active = multiple
          ? (value as string[]).includes(id)
          : value === id;
        return (
          <Tap
            key={id}
            label={label}
            onPress={() => onChange(id)}
            style={{
              paddingVertical: compact ? 10 : 12,
              paddingHorizontal: compact ? 9 : 16,
              borderRadius: 16,
              backgroundColor: active ? C.lime : C.elevated,
              borderWidth: 1,
              borderColor: active ? C.lime : C.border,
            }}
          >
            <T size={14} bold color={active ? C.bg : C.text}>
              {label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 95, gap: 3 }}>
      <T size={28} bold color={C.lime}>
        {value}
      </T>
      <T size={12} color={C.muted}>
        {label}
      </T>
    </View>
  );
}
function NumberField({
  label,
  value,
  onChange,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <Field
      label={label}
      value={String(value)}
      numeric
      onChange={(v) => {
        if (/^\d{0,4}(\.\d{0,1})?$/.test(v))
          onChange(Math.min(max, Math.max(0, Number(v) || 0)));
      }}
    />
  );
}
export default function Train() {
  const user = useAuthStore((s) => s.user),
    uid = user?.id || "guest";
  const { data, update, ready, error } = useTrain(uid);
  const [tab, setTab] = useState("plan"),
    [step, setStep] = useState(0),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Profile>({ ...initialProfile }),
    [message, setMessage] = useState(""),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""),
    [equipment, setEquipment] = useState("all"),
    [body, setBody] = useState("all"),
    [limit, setLimit] = useState(30),
    [favoriteOnly, setFavoriteOnly] = useState(false),
    [detail, setDetail] = useState<Exercise | null>(null),
    [instructions, setInstructions] = useState<Record<string, string[]>>({}),
    [lang, setLang] = useState<Language>("en"),
    [instructionError, setInstructionError] = useState("");
  const [selected, setSelected] = useState(0),
    [editPlan, setEditPlan] = useState(false),
    [running, setRunning] = useState(false),
    [seconds, setSeconds] = useState(0),
    [restUntil, setRestUntil] = useState(0),
    [restLeft, setRestLeft] = useState(0),
    [discard, setDiscard] = useState(false);
  const clock = useRef(Date.now()),
    elapsed = useRef(0),
    finishLock = useRef(false),
    scroll = useRef<ScrollView>(null);
  const active = data.active,
    plan = data.plans[selected] || data.plans[0],
    stats = weekStats(data.history);
  useEffect(() => {
    if (
      ready &&
      data.reminders &&
      data.history.some(
        (h) =>
          localDateKey(new Date(h.finishedAt || h.startedAt)) ===
          localDateKey(),
      )
    )
      void syncCompletion(uid, localDateKey()).catch(() => {});
  }, [ready, uid, data.history, data.reminders]);
  useEffect(() => {
    if (data.profile) setLang(data.profile.language);
  }, [data.profile?.language]);
  useEffect(() => {
    let live = true;
    setInstructions({});
    setInstructionError("");
    loadInstructions(lang)
      .then((s) => {
        if (live) setInstructions(s);
      })
      .catch((e) => {
        if (live) setInstructionError(e.message);
      });
    return () => {
      live = false;
    };
  }, [lang]);
  useEffect(() => {
    setRunning(false);
    setRestUntil(0);
    setSeconds(active?.elapsedSeconds || 0);
    elapsed.current = active?.elapsedSeconds || 0;
  }, [active?.id]);
  useEffect(() => {
    if (!running) return;
    clock.current = Date.now();
    const base = elapsed.current;
    const t = setInterval(() => {
      elapsed.current = base + Math.floor((Date.now() - clock.current) / 1000);
      setSeconds(elapsed.current);
    }, 500);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (!restUntil) {
      setRestLeft(0);
      return;
    }
    const tick = () => {
      const n = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
      setRestLeft(n);
      if (n === 0) {
        setRestUntil(0);
        setMessage("Rest complete. Ready for the next set?");
        void restAlert().catch(() => {});
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [restUntil]);
  useEffect(() => {
    const pause = () => {
      setRunning(false);
      update((s) =>
        s.active
          ? { ...s, active: { ...s.active, elapsedSeconds: elapsed.current } }
          : s,
      );
    };
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") pause();
    });
    return () => sub.remove();
  }, [update]);
  function changeTab(t: string) {
    setTab(t);
    setMessage("");
    setDiscard(false);
    setDetail(null);
    setProblem("");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function toggle<T>(list: T[], value: T) {
    return list.includes(value)
      ? list.filter((x) => x !== value)
      : [...list, value];
  }
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await fn();
    } catch (e: any) {
      setProblem(e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function build() {
    setProblem("");
    try {
      const p = {
        ...draft,
        equipment: [...new Set(["body weight", ...draft.equipment])],
      };
      const plans = generatePlans(p);
      if (data.reminders) {
        setProblem(
          "Turn off your current workout reminders in Settings before changing the schedule.",
        );
        return;
      }
      update((s) => ({ ...s, profile: p, plans }));
      setSelected(0);
      setEditing(false);
      setStep(0);
      setMessage("");
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (e: any) {
      setProblem(e.message);
    }
  }
  function editExercise(
    index: number,
    key: "sets" | "reps" | "rest",
    value: number,
  ) {
    update((s) => ({
      ...s,
      plans: s.plans.map((p, i) =>
        i === selected
          ? {
              ...p,
              exercises: p.exercises.map((e, j) =>
                j === index ? { ...e, [key]: value } : e,
              ),
            }
          : p,
      ),
    }));
  }
  function addExercise(e: Exercise) {
    if (!plan) {
      setProblem("Create your starting plan first.");
      return;
    }
    if (plan.exercises.length >= 12) {
      setProblem("Keep a session to 12 exercises or fewer.");
      return;
    }
    if (plan.exercises.some((x) => x.id === e.id)) {
      setMessage("That exercise is already in this session.");
      return;
    }
    update((s) => ({
      ...s,
      plans: s.plans.map((p, i) =>
        i === selected
          ? {
              ...p,
              exercises: [
                ...p.exercises,
                { id: e.id, sets: 2, reps: 10, rest: 60 },
              ],
            }
          : p,
      ),
    }));
    setMessage(
      `${e.name} added. Check its equipment and instructions before starting.`,
    );
    setDetail(null);
    changeTab("plan");
  }
  async function finish() {
    if (!active || finishLock.current) return;
    if (!active.sets.some((s) => s.done)) {
      setProblem("Log at least one completed set, or discard this session.");
      return;
    }
    finishLock.current = true;
    setRunning(false);
    const completed = {
      ...active,
      elapsedSeconds: elapsed.current,
      finishedAt: Date.now(),
    };
    update((s) => ({
      ...s,
      active: null,
      history: [
        completed,
        ...s.history.filter((h) => h.id !== completed.id),
      ].slice(0, 1000),
    }));
    setRestUntil(0);
    setMessage("Workout saved. " + progression(completed));
    void syncCompletion(uid, localDateKey()).catch(() => {});
    setTab("history");
    finishLock.current = false;
  }
  async function syncDiary(id: string) {
    const session = data.history.find((h) => h.id === id);
    if (!session || !user)
      throw Error("Sign in to add this session to your Fitkin diary.");
    const tracker = useTracker.getState();
    if (tracker.uid !== uid || !tracker.ready)
      throw Error("Your diary is still loading. Try again in a moment.");
    await tracker.saveFitness({
      id: session.id,
      version: 1,
      kind: "workout",
      log_date: localDateKey(new Date(session.startedAt)),
      name: session.name + " · Train",
      minutes: Math.max(1, Math.round(session.elapsedSeconds / 60)),
      calories: null,
      energyPolicy: "auto",
      notes: session.note,
      start: new Date(session.startedAt).toISOString(),
    });
    update((s) => ({
      ...s,
      history: s.history.map((h) =>
        h.id === id ? { ...h, trackerSaved: true } : h,
      ),
    }));
    setMessage(
      "Added to your fitness diary. Burn stays unknown unless you record it.",
    );
  }
  const showSetup = !data.profile || editing;
  const filtered = catalog.filter(
    (e) =>
      (!query ||
        `${e.name} ${e.target} ${e.secondary_muscles.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (equipment === "all" || e.equipment === equipment) &&
      (body === "all" || e.category === body) &&
      (!favoriteOnly || data.favorites.includes(e.id)),
  );
  return (
    <Page
      back
      scrollRef={scroll}
      testID="train-screen"
      eyebrow="FITKIN TRAIN"
      title={
        active
          ? "One set at a time."
          : showSetup
            ? "A plan that fits you."
            : "Your next little win."
      }
      subtitle={
        showSetup
          ? "A few questions. A starting plan you can make your own."
          : "Train with intention. Keep the progress, leave the pressure."
      }
    >
      {!ready ? (
        <Banner
          text={error || "Loading your saved workouts…"}
          error={!!error}
        />
      ) : (
        <>
          {error && <Banner error text={error} />}{" "}
          {problem && <Banner error text={problem} />}{" "}
          {message && <Banner text={message} />}
          {active ? (
            <>
              <Card>
                <T bold size={23}>
                  {active.name}
                </T>
                <View style={S.row}>
                  <Stat
                    value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
                    label={running ? "Session timer" : "Timer paused"}
                  />
                  <Stat
                    value={`${completedSets(active)}/${active.sets.length}`}
                    label="Sets completed"
                  />
                </View>
                <Meter
                  value={(100 * completedSets(active)) / active.sets.length}
                  color={C.lime}
                />
                <Button
                  secondary
                  title={running ? "Pause workout" : "Resume workout"}
                  onPress={() => {
                    if (running)
                      update((s) =>
                        s.active
                          ? {
                              ...s,
                              active: {
                                ...s.active,
                                elapsedSeconds: elapsed.current,
                              },
                            }
                          : s,
                      );
                    setRunning(!running);
                  }}
                />
                {restLeft > 0 && (
                  <>
                    <T size={25} bold color={C.blue}>
                      Rest · {restLeft}s
                    </T>
                    <Button
                      secondary
                      title="Skip rest"
                      onPress={() => setRestUntil(0)}
                    />
                  </>
                )}
                <T size={12} color={C.muted}>
                  Rest alerts work while this screen is active. Take longer
                  whenever you need it.
                </T>
              </Card>
              {active.plan.exercises.map((e, index) => (
                <Card key={e.id}>
                  <Tap
                    onPress={() => setDetail(getExercise(e.id) || null)}
                    label={`Instructions for ${getExercise(e.id)?.name}`}
                  >
                    <T bold size={20}>
                      {index + 1}. {getExercise(e.id)?.name}
                    </T>
                    <T color={C.lime} size={13}>
                      View instructions
                    </T>
                  </Tap>
                  {active.sets.map((set, i) =>
                    set.exerciseId !== e.id ? null : (
                      <View
                        key={i}
                        style={{
                          gap: 8,
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderColor: C.border,
                        }}
                      >
                        <T bold>Set {set.set + 1}</T>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <NumberField
                              label={`Reps ${index + 1}.${set.set + 1}`}
                              value={set.reps}
                              max={100}
                              onChange={(n) =>
                                update((s) =>
                                  s.active
                                    ? {
                                        ...s,
                                        active: {
                                          ...s.active,
                                          sets: s.active.sets.map((x, j) =>
                                            j === i ? { ...x, reps: n } : x,
                                          ),
                                        },
                                      }
                                    : s,
                                )
                              }
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <NumberField
                              label={`Load kg ${index + 1}.${set.set + 1}`}
                              value={set.kg}
                              max={500}
                              onChange={(n) =>
                                update((s) =>
                                  s.active
                                    ? {
                                        ...s,
                                        active: {
                                          ...s.active,
                                          sets: s.active.sets.map((x, j) =>
                                            j === i ? { ...x, kg: n } : x,
                                          ),
                                        },
                                      }
                                    : s,
                                )
                              }
                            />
                          </View>
                        </View>
                        <Button
                          secondary={set.done}
                          title={
                            set.done
                              ? `Set ${index + 1}.${set.set + 1} complete · undo`
                              : `Complete set ${index + 1}.${set.set + 1}`
                          }
                          disabled={!set.reps}
                          onPress={() => {
                            update((s) =>
                              s.active
                                ? {
                                    ...s,
                                    active: {
                                      ...s.active,
                                      elapsedSeconds: elapsed.current,
                                      sets: s.active.sets.map((x, j) =>
                                        j === i ? { ...x, done: !x.done } : x,
                                      ),
                                    },
                                  }
                                : s,
                            );
                            if (!set.done && e.rest > 0)
                              setRestUntil(Date.now() + e.rest * 1000);
                          }}
                        />
                      </View>
                    ),
                  )}
                </Card>
              ))}
              <Card>
                <T bold>How did it feel?</T>
                <Choices
                  items={[
                    ["4", "Comfortable"],
                    ["6", "Challenging"],
                    ["9", "Very hard"],
                  ]}
                  value={String(active.effort)}
                  onChange={(v) =>
                    update((s) =>
                      s.active
                        ? { ...s, active: { ...s.active, effort: Number(v) } }
                        : s,
                    )
                  }
                />
                <Field
                  label="Workout notes"
                  value={active.note}
                  onChange={(note) =>
                    update((s) =>
                      s.active
                        ? {
                            ...s,
                            active: { ...s.active, note: note.slice(0, 500) },
                          }
                        : s,
                    )
                  }
                />
                <Button
                  title="Finish & save workout"
                  onPress={() => void finish()}
                />
                <Button
                  secondary
                  title={
                    discard ? "Yes, discard this workout" : "Discard workout"
                  }
                  onPress={() => {
                    if (discard) {
                      update((s) => ({ ...s, active: null }));
                      setDiscard(false);
                      setRunning(false);
                    } else setDiscard(true);
                  }}
                />
              </Card>
            </>
          ) : showSetup ? (
            <>
              <T color={C.lime}>Question {step + 1} of 5</T>
              <Meter value={(100 * (step + 1)) / 5} color={C.lime} />
              {step === 0 && (
                <Card>
                  <T bold size={22}>
                    What would you like to work on?
                  </T>
                  <Choices
                    items={goals}
                    value={draft.goal}
                    onChange={(v) =>
                      setDraft({ ...draft, goal: v as Profile["goal"] })
                    }
                  />
                  <T color={C.muted}>
                    Your training goal shapes starting reps and rest. No
                    promised body changes or guessed calorie burn.
                  </T>
                </Card>
              )}
              {step === 1 && (
                <Card>
                  <T bold size={22}>
                    Where are you starting?
                  </T>
                  <Choices
                    items={[
                      ["new", "Just getting started"],
                      ["returning", "Returning after a break"],
                      ["regular", "I train regularly"],
                    ]}
                    value={draft.experience}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        experience: v as Profile["experience"],
                      })
                    }
                  />
                  <T bold>Before we build your plan</T>
                  <Choices
                    items={[["adult", "I’m 18 or older"]]}
                    multiple
                    value={draft.adult ? ["adult"] : []}
                    onChange={() => setDraft({ ...draft, adult: !draft.adult })}
                  />
                  <Choices
                    items={[
                      [
                        "clear",
                        "I can exercise without restrictions, or have individual clearance",
                      ],
                    ]}
                    multiple
                    value={draft.clearance ? ["clear"] : []}
                    onChange={() =>
                      setDraft({ ...draft, clearance: !draft.clearance })
                    }
                  />
                  <T size={13} color={C.muted}>
                    If pain, injury, pregnancy or a health condition affects
                    exercise, get individual guidance first. This planner cannot
                    assess those needs.
                  </T>
                </Card>
              )}
              {step === 2 && (
                <Card>
                  <T bold size={22}>
                    What do you have available?
                  </T>
                  <T color={C.muted}>
                    Bodyweight is always included. Some exercises still need a
                    wall or clear floor space.
                  </T>
                  <Choices
                    items={[
                      ["dumbbell", "Dumbbells"],
                      ["resistance band", "Resistance band"],
                    ]}
                    multiple
                    value={draft.equipment}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        equipment: toggle(draft.equipment, v),
                      })
                    }
                  />
                  <T bold>Movements you want to avoid</T>
                  <T size={13} color={C.muted}>
                    These are preferences, not an injury treatment plan.
                  </T>
                  <Choices
                    items={[
                      "knees",
                      "hips",
                      "back",
                      "shoulders",
                      "wrists",
                      "elbows",
                      "ankles",
                    ].map((v) => [v, v])}
                    multiple
                    value={draft.avoid}
                    onChange={(v) =>
                      setDraft({ ...draft, avoid: toggle(draft.avoid, v) })
                    }
                  />
                </Card>
              )}
              {step === 3 && (
                <Card>
                  <T bold size={22}>
                    Make room in your week.
                  </T>
                  <Choices
                    items={[15, 25, 40, 55].map((n) => [
                      String(n),
                      n + " minutes",
                    ])}
                    value={String(draft.minutes)}
                    onChange={(v) => setDraft({ ...draft, minutes: Number(v) })}
                  />
                  <T bold>Training days</T>
                  <Choices
                    items={dayNames.map((v, i) => [String(i), v])}
                    multiple
                    value={draft.days.map(String)}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        days: toggle(draft.days, Number(v)),
                      })
                    }
                  />
                  <T color={C.muted} size={13}>
                    Choose 1–5 days. Leave recovery days between demanding
                    sessions when possible.
                  </T>
                  <DateTimeField
                    label="Preferred workout time"
                    mode="time"
                    value={draft.time}
                    onChange={(time) => setDraft({ ...draft, time })}
                  />
                </Card>
              )}
              {step === 4 && (
                <Card>
                  <T bold size={22}>
                    Make it feel like yours.
                  </T>
                  <T>Exercise instruction language</T>
                  <Choices
                    items={Object.entries(languages)}
                    value={draft.language}
                    onChange={(v) =>
                      setDraft({ ...draft, language: v as Language })
                    }
                  />
                  <T size={13} color={C.muted}>
                    Exercise names and app controls are in English; instructions
                    use your chosen language.
                  </T>
                  <Field
                    label="Body weight · kg (optional)"
                    numeric
                    value={draft.weight === null ? "" : String(draft.weight)}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        weight: v === "" ? null : Number(v),
                      })
                    }
                  />
                  <T size={12} color={C.muted}>
                    Stored with your training profile. We do not use it to
                    invent calories burned.
                  </T>
                  <T>Encouragement style</T>
                  <Choices
                    items={[
                      ["gentle", "Gentle"],
                      ["playful", "A little playful"],
                    ]}
                    value={draft.tone}
                    onChange={(v) =>
                      setDraft({ ...draft, tone: v as Profile["tone"] })
                    }
                  />
                  <T color={C.lime}>
                    {draft.days.length} days a week ·{" "}
                    {draft.days.length * draft.minutes} planned minutes
                  </T>
                </Card>
              )}
              <Button
                title={step === 4 ? "Build my workout plan" : "Continue"}
                onPress={() => {
                  setProblem("");
                  if (step === 1 && (!draft.adult || !draft.clearance)) {
                    setProblem(
                      "Please review the two readiness statements before continuing.",
                    );
                    return;
                  }
                  if (
                    step === 3 &&
                    (!draft.days.length || draft.days.length > 5)
                  ) {
                    setProblem("Choose 1–5 training days.");
                    return;
                  }
                  if (step === 4) build();
                  else {
                    setStep(step + 1);
                    scroll.current?.scrollTo({ y: 0, animated: false });
                  }
                }}
              />
              {step > 0 && (
                <Button
                  secondary
                  title="Previous question"
                  onPress={() => setStep(step - 1)}
                />
              )}{" "}
              {editing && (
                <Button
                  secondary
                  title="Keep current plan"
                  onPress={() => setEditing(false)}
                />
              )}
            </>
          ) : (
            <>
              <Choices
                compact
                items={[
                  ["plan", "My plan"],
                  ["library", "Exercises"],
                  ["history", "Progress"],
                  ["settings", "Settings"],
                ]}
                value={tab}
                onChange={changeTab}
              />
              {tab === "plan" && (
                <>
                  <Choices
                    items={data.plans.map((p, i) => [String(i), p.name])}
                    value={String(selected)}
                    onChange={(v) => setSelected(Number(v))}
                  />
                  {plan && (
                    <>
                      <Card>
                        <T bold size={24}>
                          {plan.name}
                        </T>
                        <T color={C.lime}>
                          {estimateMinutes(plan.exercises)} min estimate ·{" "}
                          {plan.exercises.length} exercises ·{" "}
                          {plan.exercises.reduce((n, e) => n + e.sets, 0)} sets
                        </T>
                        <T color={C.muted} size={13}>
                          {plan.reason}
                        </T>
                        <T size={13}>
                          Start with 5 minutes of comfortable movement. Use a
                          load you control and stop an exercise if it causes
                          pain.
                        </T>
                        <Button
                          title="Start this workout"
                          disabled={
                            !plan.exercises.length ||
                            plan.exercises.some((e) => e.sets < 1 || e.reps < 1)
                          }
                          onPress={() => {
                            update((s) => ({
                              ...s,
                              active: createSession(plan, Crypto.randomUUID()),
                            }));
                            setMessage(
                              "Session ready. Tap Resume workout when you’re ready to begin.",
                            );
                          }}
                        />
                        <Tap
                          label={
                            editPlan ? "Done editing" : "Edit this session"
                          }
                          onPress={() => setEditPlan(!editPlan)}
                        >
                          <T color={C.lime}>
                            {editPlan ? "Done editing" : "Edit this session"}
                          </T>
                        </Tap>
                      </Card>
                      <Card style={{ backgroundColor: C.elevated }}>
                        <View style={S.row}>
                          <Stat
                            value={`${stats.sessions}/${data.profile!.days.length}`}
                            label="Sessions this week"
                          />
                          <Stat value={stats.minutes} label="Minutes logged" />
                          <Stat value={stats.sets} label="Sets completed" />
                        </View>
                        <T color={C.muted}>
                          {stats.sessions === 0
                            ? "Your next session can start with one comfortable set."
                            : data.profile!.tone === "playful"
                              ? "Look at you, collecting proof that you showed up."
                              : "You’re making time for yourself. Keep your next step manageable."}
                        </T>
                      </Card>
                      <T bold>Your weekly rhythm</T>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 9,
                        }}
                      >
                        {dayNames.map((d, i) => (
                          <View
                            key={d}
                            style={{
                              alignItems: "center",
                              padding: 10,
                              borderRadius: 14,
                              backgroundColor: data.profile!.days.includes(i)
                                ? C.elevated
                                : C.bg,
                            }}
                          >
                            <T
                              size={13}
                              color={
                                data.profile!.days.includes(i)
                                  ? C.lime
                                  : C.muted
                              }
                            >
                              {d}
                            </T>
                            <Icon
                              size={17}
                              name={
                                data.profile!.days.includes(i)
                                  ? "barbell-outline"
                                  : "leaf-outline"
                              }
                              color={
                                data.profile!.days.includes(i)
                                  ? C.lime
                                  : C.muted
                              }
                            />
                          </View>
                        ))}
                      </View>
                      {plan.exercises.map((e, i) => (
                        <Card key={e.id}>
                          <View style={S.row}>
                            <View style={{ flex: 1 }}>
                              <T bold size={18}>
                                {getExercise(e.id)?.name}
                              </T>
                              <T size={13} color={C.muted}>
                                {getExercise(e.id)?.target} ·{" "}
                                {getExercise(e.id)?.equipment}
                              </T>
                            </View>
                            <Tap
                              label={`View ${getExercise(e.id)?.name}`}
                              onPress={() =>
                                setDetail(getExercise(e.id) || null)
                              }
                            >
                              <Icon name="information-circle-outline" />
                            </Tap>
                          </View>
                          <T color={C.lime}>
                            {e.sets} sets × {e.reps} reps · {e.rest}s rest
                          </T>
                          {editPlan && (
                            <>
                              <View style={{ flexDirection: "row", gap: 10 }}>
                                {(["sets", "reps", "rest"] as const).map(
                                  (k) => (
                                    <View style={{ flex: 1 }} key={k}>
                                      <NumberField
                                        label={`${k} ${i + 1}`}
                                        value={e[k]}
                                        max={
                                          k === "sets"
                                            ? 6
                                            : k === "reps"
                                              ? 100
                                              : 300
                                        }
                                        onChange={(n) =>
                                          editExercise(i, k, Math.round(n))
                                        }
                                      />
                                    </View>
                                  ),
                                )}
                              </View>
                              <Button
                                secondary
                                title={`Remove ${getExercise(e.id)?.name}`}
                                onPress={() =>
                                  update((s) => ({
                                    ...s,
                                    plans: s.plans.map((p, j) =>
                                      j === selected
                                        ? {
                                            ...p,
                                            exercises: p.exercises.filter(
                                              (_, k) => k !== i,
                                            ),
                                          }
                                        : p,
                                    ),
                                  }))
                                }
                              />
                            </>
                          )}
                        </Card>
                      ))}
                      <Button
                        secondary
                        title="Add an exercise"
                        icon="add"
                        onPress={() => changeTab("library")}
                      />
                    </>
                  )}
                  <T color={C.muted} size={12}>
                    Plans use transparent starting templates, not an AI model.
                    Manual additions are your choices; check supporting
                    equipment and suitability.
                  </T>
                </>
              )}
              {tab === "library" && (
                <>
                  <T bold size={23}>
                    Find your next movement.
                  </T>
                  <T color={C.muted}>
                    1,324 exercises. Clear instructions in 10 languages.
                  </T>
                  <Field
                    label="Search exercises"
                    testID="exercise-search"
                    value={query}
                    onChange={(v) => {
                      setQuery(v);
                      setLimit(30);
                    }}
                  />
                  <T size={13}>Equipment</T>
                  <Choices
                    items={[
                      ["all", "All equipment"],
                      ["body weight", "Bodyweight"],
                      ["dumbbell", "Dumbbells"],
                      ["barbell", "Barbell"],
                      ["resistance band", "Resistance band"],
                      ["band", "Band"],
                      ["cable", "Cable"],
                    ]}
                    value={equipment}
                    onChange={(v) => {
                      setEquipment(v);
                      setLimit(30);
                    }}
                  />
                  <T size={13}>Body area</T>
                  <Choices
                    items={[
                      ["all", "All areas"],
                      ...[...new Set(catalog.map((e) => e.category))].map(
                        (v) => [v, v],
                      ),
                    ]}
                    value={body}
                    onChange={(v) => {
                      setBody(v);
                      setLimit(30);
                    }}
                  />
                  <Tap
                    label="Toggle saved exercises"
                    onPress={() => setFavoriteOnly(!favoriteOnly)}
                  >
                    <T color={C.lime}>
                      {favoriteOnly
                        ? "Showing saved exercises · show all"
                        : "Show saved exercises"}
                    </T>
                  </Tap>
                  <T color={C.muted}>{filtered.length} matching exercises</T>
                  {!filtered.length && (
                    <Banner text="No matches. Try a different name or clear your filters." />
                  )}
                  {filtered.slice(0, limit).map((e) => (
                    <Card key={e.id}>
                      <Tap
                        label={`Open ${e.name}`}
                        onPress={() => setDetail(e)}
                      >
                        <View style={S.row}>
                          <Icon name="barbell-outline" />
                          <View style={{ flex: 1 }}>
                            <T bold>{e.name}</T>
                            <T size={13} color={C.muted}>
                              {e.target} · {e.equipment}
                            </T>
                          </View>
                          <Icon name="chevron-forward" size={17} />
                        </View>
                      </Tap>
                    </Card>
                  ))}
                  {filtered.length > limit && (
                    <Button
                      secondary
                      title="Show more exercises"
                      onPress={() => setLimit(limit + 30)}
                    />
                  )}
                  <T size={12} color={C.muted}>
                    Text dataset: Hasan Emir Yıldırım, MIT licence. Exercise
                    media is not included. Read instructions carefully; names
                    and translations may contain source-data errors.
                  </T>
                </>
              )}
              {tab === "history" && (
                <>
                  <Card>
                    <T bold size={22}>
                      The effort adds up.
                    </T>
                    <View style={S.row}>
                      <Stat
                        value={data.history.length}
                        label="Saved workouts"
                      />
                      <Stat
                        value={stats.volume.toLocaleString()}
                        label="kg × reps this week"
                      />
                    </View>
                    <T size={12} color={C.muted}>
                      Volume counts completed sets with an external load.
                      Bodyweight sets still count as sets. These totals are not
                      calories.
                    </T>
                  </Card>
                  {!data.history.length && (
                    <Banner text="Your first completed session will appear here, with sets, time and notes." />
                  )}
                  {data.history.map((h) => (
                    <Card key={h.id}>
                      <T bold size={20}>
                        {h.name}
                      </T>
                      <T color={C.muted}>
                        {new Date(h.startedAt).toLocaleDateString()} ·{" "}
                        {Math.round(h.elapsedSeconds / 60)} min ·{" "}
                        {completedSets(h)} sets
                      </T>
                      <T color={C.lime}>
                        {volume(h.sets).toLocaleString()} kg × reps · effort{" "}
                        {h.effort}/10
                      </T>
                      {h.note && <T>{h.note}</T>}
                      <T size={13}>{progression(h)}</T>
                      {user && !h.trackerSaved && (
                        <Button
                          secondary
                          title="Add to fitness diary"
                          loading={busy}
                          onPress={() => void task(() => syncDiary(h.id))}
                        />
                      )}{" "}
                      {h.trackerSaved && (
                        <T size={12} color={C.muted}>
                          Added to fitness diary
                        </T>
                      )}
                    </Card>
                  ))}
                </>
              )}
              {tab === "settings" && (
                <>
                  <Card>
                    <T bold size={22}>
                      Encouragement, on your terms.
                    </T>
                    <T color={C.muted}>
                      {data.profile!.days.map((d) => dayNames[d]).join(", ")} at{" "}
                      {data.profile!.time}. Quiet hours: 22:00–08:00.
                    </T>
                    <T size={13}>
                      Enable sends your notification subscription, schedule and
                      timezone to this site’s reminder service. Workout details
                      stay on this device.{" "}
                      {Platform.OS === "web"
                        ? "One reminder per training day; completed days can be skipped after online sync."
                        : "Weekly reminders follow your chosen schedule, including days you have already trained."}
                    </T>
                    <Button
                      title={
                        data.reminders
                          ? "Turn off workout reminders"
                          : "Enable workout reminders"
                      }
                      loading={busy}
                      onPress={() =>
                        void task(async () => {
                          if (data.reminders) {
                            await disableReminders(uid);
                            update((s) => ({ ...s, reminders: false }));
                            setMessage("Workout reminders turned off.");
                          } else {
                            if (
                              +data.profile!.time.slice(0, 2) < 8 ||
                              +data.profile!.time.slice(0, 2) >= 22
                            )
                              throw Error(
                                "Choose a reminder time between 08:00 and 21:59 to respect quiet hours.",
                              );
                            setMessage(
                              await enableReminders(data.profile!, uid),
                            );
                            update((s) => ({ ...s, reminders: true }));
                          }
                        })
                      }
                    />
                    <Button
                      secondary
                      title="Export calendar reminders"
                      onPress={() =>
                        void task(async () => {
                          await downloadFile(
                            "fitkin-workouts.ics",
                            calendarFile(data.profile!),
                            "text/calendar",
                          );
                          setMessage(
                            "Calendar file exported. Import it in your calendar and check its alert settings. Importing again may create duplicates.",
                          );
                        })
                      }
                    />
                    <T size={12} color={C.muted}>
                      Reminders are saved on this phone and can arrive offline.
                      Allow notifications in Android settings. Delivery may be
                      delayed by battery-saving settings.
                    </T>
                  </Card>

                  <Button
                    secondary
                    title="Change my training answers"
                    onPress={() => {
                      setDraft({ ...data.profile! });
                      setEditing(true);
                      setStep(0);
                    }}
                  />
                  <Button
                    secondary
                    title="Export my training data"
                    onPress={() =>
                      void task(() =>
                        downloadFile(
                          "fitkin-training.json",
                          JSON.stringify(data, null, 2),
                          "application/json",
                        ),
                      )
                    }
                  />
                  <Card>
                    <T bold>Saved on this device</T>
                    <T color={C.muted}>
                      Plans and detailed set logs stay on this phone, separately
                      for each account. Export a backup before clearing app data
                      or changing phones.
                    </T>
                    <Button
                      secondary
                      title={
                        discard
                          ? "Confirm delete training data"
                          : "Delete training data"
                      }
                      onPress={() =>
                        void task(async () => {
                          if (!discard) {
                            setDiscard(true);
                            return;
                          }
                          if (data.reminders) await disableReminders(uid);
                          update(() => ({
                            profile: null,
                            plans: [],
                            history: [],
                            active: null,
                            favorites: [],
                            reminders: false,
                          }));
                          setDraft({ ...initialProfile });
                          setStep(0);
                          setDiscard(false);
                          setMessage("Training data removed from this device.");
                        })
                      }
                    />
                  </Card>
                </>
              )}
            </>
          )}
          {detail && (
            <Modal
              visible
              transparent
              animationType="slide"
              onRequestClose={() => setDetail(null)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#000a",
                  justifyContent: "center",
                  padding: 20,
                }}
              >
                <ScrollView
                  contentContainerStyle={{
                    width: "100%",
                    maxWidth: 680,
                    alignSelf: "center",
                    paddingVertical: 30,
                  }}
                >
                  <Card style={{ borderColor: C.lime }}>
                    <T bold size={24}>
                      {detail.name}
                    </T>
                    <T color={C.muted}>
                      {detail.category} · {detail.target} · {detail.equipment}
                    </T>
                    <Choices
                      items={Object.entries(languages)}
                      value={lang}
                      onChange={(v) => setLang(v as Language)}
                    />
                    {instructionError ? (
                      <Banner error text={instructionError} />
                    ) : !instructions[detail.id] ? (
                      <T>Loading instructions…</T>
                    ) : (
                      instructions[detail.id].map((line, i) => (
                        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                          <T bold color={C.lime}>
                            {i + 1}.
                          </T>
                          <T style={{ flex: 1 }}>{line}</T>
                        </View>
                      ))
                    )}
                    <T size={12} color={C.muted}>
                      Check the equipment described in the steps. No exercise
                      photo or animation is supplied.
                    </T>
                    <Button
                      secondary
                      title={
                        data.favorites.includes(detail.id)
                          ? "Remove from saved exercises"
                          : "Save exercise"
                      }
                      onPress={() =>
                        update((s) => ({
                          ...s,
                          favorites: toggle(s.favorites, detail.id),
                        }))
                      }
                    />
                    {!active && data.profile && (
                      <Button
                        title="Add to selected workout"
                        onPress={() => addExercise(detail)}
                      />
                    )}
                    <Button
                      secondary
                      title="Close instructions"
                      onPress={() => setDetail(null)}
                    />
                  </Card>
                </ScrollView>
              </View>
            </Modal>
          )}
        </>
      )}
    </Page>
  );
}
