import catalogData from "./data/catalog.json";
export type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  target: string;
  secondary_muscles: string[];
};
export const catalog = catalogData as Exercise[];
export const languages = {
  en: "English",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  tr: "Türkçe",
  ru: "Русский",
  zh: "中文",
  ko: "한국어",
  pl: "Polski",
};
export type Language = keyof typeof languages;
export type Profile = {
  goal: "habit" | "strength" | "muscle" | "fitness";
  experience: "new" | "returning" | "regular";
  minutes: number;
  days: number[];
  equipment: string[];
  avoid: string[];
  adult: boolean;
  clearance: boolean;
  weight: number | null;
  language: Language;
  time: string;
  tone: "gentle" | "playful";
};
export type PlanExercise = {
  id: string;
  sets: number;
  reps: number;
  rest: number;
};
export type Plan = {
  name: string;
  exercises: PlanExercise[];
  minutes: number;
  reason: string;
};
export type SetLog = {
  exerciseId: string;
  set: number;
  reps: number;
  kg: number;
  done: boolean;
};
export type Session = {
  id: string;
  date: string;
  name: string;
  startedAt: number;
  finishedAt: number | null;
  elapsedSeconds: number;
  sets: SetLog[];
  effort: number;
  note: string;
  plan: Plan;
  trackerSaved?: boolean;
};
export type TrainData = {
  profile: Profile | null;
  plans: Plan[];
  history: Session[];
  active: Session | null;
  favorites: string[];
  reminders: boolean;
};
export const blankData = (): TrainData => ({
  profile: null,
  plans: [],
  history: [],
  active: null,
  favorites: [],
  reminders: false,
});
export const initialProfile: Profile = {
  goal: "habit",
  experience: "new",
  minutes: 25,
  days: [1, 3, 5],
  equipment: ["body weight"],
  avoid: [],
  adult: false,
  clearance: false,
  weight: null,
  language: "en",
  time: "18:00",
  tone: "gentle",
};
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Deliberately small, reviewed template pool. Catalog metadata alone does not establish
// difficulty or required supporting equipment (a "body weight" row can need a bar).
const pool: {
  id: string;
  group: string;
  requires: string[];
  avoid: string[];
  level: number;
}[] = [
  {
    id: "0659",
    group: "push",
    requires: [],
    avoid: ["shoulders", "wrists"],
    level: 0,
  },
  {
    id: "3211",
    group: "push",
    requires: [],
    avoid: ["shoulders", "wrists", "knees"],
    level: 1,
  },
  {
    id: "0662",
    group: "push",
    requires: [],
    avoid: ["shoulders", "wrists"],
    level: 2,
  },
  { id: "0276", group: "core", requires: [], avoid: ["back"], level: 0 },
  {
    id: "3013",
    group: "hinge",
    requires: [],
    avoid: ["back", "hips"],
    level: 0,
  },
  { id: "1373", group: "legs", requires: [], avoid: ["ankles"], level: 0 },
  {
    id: "1685",
    group: "squat",
    requires: [],
    avoid: ["knees", "hips", "back", "shoulders"],
    level: 0,
  },
  {
    id: "0293",
    group: "pull",
    requires: ["dumbbell"],
    avoid: ["back", "shoulders", "wrists"],
    level: 1,
  },
  {
    id: "0294",
    group: "pull",
    requires: ["dumbbell"],
    avoid: ["wrists", "elbows"],
    level: 0,
  },
  {
    id: "1760",
    group: "squat",
    requires: ["dumbbell"],
    avoid: ["knees", "hips", "back", "wrists"],
    level: 1,
  },
  {
    id: "0417",
    group: "legs",
    requires: ["dumbbell"],
    avoid: ["ankles", "wrists"],
    level: 0,
  },
  {
    id: "0426",
    group: "push",
    requires: ["dumbbell"],
    avoid: ["shoulders", "back", "wrists"],
    level: 1,
  },
  {
    id: "3144",
    group: "pull",
    requires: ["resistance band"],
    avoid: ["shoulders", "back", "wrists"],
    level: 0,
  },
  {
    id: "3124",
    group: "push",
    requires: ["resistance band"],
    avoid: ["shoulders", "wrists"],
    level: 0,
  },
  {
    id: "3123",
    group: "pull",
    requires: ["resistance band"],
    avoid: ["elbows", "wrists"],
    level: 0,
  },
];
export function validateProfile(p: Profile) {
  if (!p.adult) return "This planner is designed for adults aged 18 and over.";
  if (!p.clearance)
    return "If pain, an injury, pregnancy or a health condition affects exercise, get individual guidance before using an automatic plan.";
  if (
    !p.days.length ||
    p.days.length > 5 ||
    p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    return "Choose between 1 and 5 training days.";
  if (![15, 25, 40, 55].includes(p.minutes)) return "Choose a session length.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))
    return "Choose a valid reminder time.";
  if (
    p.weight !== null &&
    (!Number.isFinite(p.weight) || p.weight < 30 || p.weight > 350)
  )
    return "Enter a weight between 30 and 350 kg, or leave it blank.";
  return null;
}
export function generatePlans(p: Profile): Plan[] {
  const error = validateProfile(p);
  if (error) throw Error(error);
  const level =
    p.experience === "new" ? 0 : p.experience === "returning" ? 1 : 2;
  const available = pool.filter(
    (x) =>
      x.level <= level &&
      x.requires.every((e) => p.equipment.includes(e)) &&
      !x.avoid.some((a) => p.avoid.includes(a)),
  );
  const groups = ["squat", "push", "hinge", "pull", "core", "legs"];
  const count = p.minutes === 15 ? 3 : p.minutes === 25 ? 4 : 6;
  return Array.from({ length: Math.min(3, p.days.length) }, (_, i) => {
    const selected: typeof pool = [];
    for (const group of groups) {
      const choices = available.filter((x) => x.group === group);
      if (choices.length)
        selected.push(
          choices[
            (i + (p.goal === "strength" ? choices.length - 1 : 0)) %
              choices.length
          ],
        );
    }
    if (selected.length < 3)
      throw Error(
        "These movement preferences leave too few exercises for a balanced automatic session. Adjust them only if appropriate, or build a routine with a qualified trainer.",
      );
    const sets =
      p.minutes === 15
        ? 2
        : p.minutes === 25
          ? 2
          : p.experience === "new"
            ? 2
            : 3;
    const rest = p.goal === "strength" ? 90 : 60;
    const exercises = selected
      .slice(0, count)
      .map((x) => ({
        id: x.id,
        sets,
        reps: p.goal === "strength" ? 8 : p.goal === "muscle" ? 12 : 10,
        rest,
      }));
    return {
      name: ["Foundation", "Build your rhythm", "Keep it steady"][i],
      exercises,
      minutes: estimateMinutes(exercises),
      reason: `${p.minutes}-minute preference · ${p.experience === "new" ? "beginner starting volume" : p.experience + " routine"} · equipment and movement preferences applied. Choose a comfortable effort; adjust every exercise before starting.`,
    };
  });
}
export function estimateMinutes(exercises: PlanExercise[]) {
  return Math.ceil(
    5 +
      exercises.reduce(
        (sum, e) => sum + e.sets * (e.reps * 3 + e.rest) + 30,
        0,
      ) /
        60,
  );
}
export function getExercise(id: string) {
  return catalog.find((x) => x.id === id);
}
export function nextTraining(p: Profile, now = new Date()) {
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(...(p.time.split(":").map(Number) as [number, number]), 0, 0);
    if (p.days.includes(d.getDay()) && d >= now) return d;
  }
  return now;
}
export function volume(sets: SetLog[]) {
  return Math.round(
    sets.filter((s) => s.done).reduce((sum, s) => sum + s.reps * s.kg, 0),
  );
}
export function completedSets(s: Session) {
  return s.sets.filter((x) => x.done).length;
}
export function weekStats(history: Session[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const sessions = history.filter(
    (s) => s.finishedAt && s.finishedAt >= +start && s.finishedAt <= +now,
  );
  return {
    sessions: sessions.length,
    sets: sessions.reduce((n, s) => n + completedSets(s), 0),
    minutes: Math.round(
      sessions.reduce((n, s) => n + s.elapsedSeconds, 0) / 60,
    ),
    volume: sessions.reduce((n, s) => n + volume(s.sets), 0),
  };
}
export function progression(session: Session) {
  if (session.effort >= 8)
    return "That felt demanding. Keep the same load or reduce it next time; recovery counts too.";
  if (session.effort <= 5 && completedSets(session) === session.sets.length)
    return "All planned sets felt comfortable. Next time, consider one more repetition per set while keeping good form.";
  return "Keep your current targets and focus on comfortable, controlled repetitions.";
}
export function createSession(
  plan: Plan,
  id: string,
  now = Date.now(),
): Session {
  return {
    id,
    date: new Date(now).toLocaleDateString("en-CA"),
    name: plan.name,
    startedAt: now,
    finishedAt: null,
    elapsedSeconds: 0,
    sets: plan.exercises.flatMap((e) =>
      Array.from({ length: e.sets }, (_, set) => ({
        exerciseId: e.id,
        set,
        reps: e.reps,
        kg: 0,
        done: false,
      })),
    ),
    effort: 6,
    note: "",
    plan: JSON.parse(JSON.stringify(plan)),
  };
}
export function calendarFile(p: Profile) {
  const start = nextTraining(p),
    local = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const end = new Date(+start + p.minutes * 60000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fitkin//Train//EN",
    "BEGIN:VEVENT",
    "UID:fitkin-train-" + start.getTime(),
    "DTSTAMP:" +
      new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z/, "Z"),
    "DTSTART:" + local(start),
    "DTEND:" + local(end),
    "RRULE:FREQ=WEEKLY;BYDAY=" +
      p.days
        .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d])
        .join(","),
    "SUMMARY:Time for your Fitkin workout",
    "DESCRIPTION:Open Fitkin Train to start your planned session.",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your workout starts in 10 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
