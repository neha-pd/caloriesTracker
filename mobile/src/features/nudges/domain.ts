export interface NudgeSettings {
  enabled: boolean;
  workouts: boolean;
  steps: boolean;
  water: boolean;
  fitness: number;
  breakfast: string;
  lunch: string;
  dinner: string;
  quietStart: string;
  quietEnd: string;
  enabledAt: string;
}
export const defaultNudges: NudgeSettings = {
  enabled: false,
  workouts: false,
  steps: true,
  water: false,
  fitness: 1,
  breakfast: "08:30",
  lunch: "13:00",
  dinner: "19:30",
  quietStart: "22:00",
  quietEnd: "08:00",
  enabledAt: "",
};
export function clockMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw Error("Choose a valid time.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function isQuiet(minute: number, start: number, end: number) {
  return start === end
    ? false
    : start > end
      ? minute >= start || minute < end
      : minute >= start && minute < end;
}
export function validateNudges(s: NudgeSettings) {
  const start = clockMinutes(s.quietStart),
    end = clockMinutes(s.quietEnd);
  const meals = [s.breakfast, s.lunch, s.dinner].map(clockMinutes);
  if (meals.some((m) => isQuiet(m, start, end)))
    throw Error("Choose meal times outside your quiet hours.");
  if (new Set(meals).size < 3)
    throw Error("Choose different times for breakfast, lunch and dinner.");
  if (!Number.isInteger(s.fitness) || s.fitness < 0 || s.fitness > 2)
    throw Error("Choose zero, one or two movement nudges.");
  return s;
}
// Rotating copy is chosen on the phone at delivery. Tokens use the day's actual saved data.
export const nudgeCopy = {
  breakfast: [
    [
      "Breakfast has entered the chat ☀️",
      "Idli, eggs, or something else? Give your breakfast a little diary moment.",
    ],
    [
      "Morning, {name} ☀️",
      "What fuelled your morning? Your breakfast log is still waiting.",
    ],
    [
      "Tiny breakfast check-in 🍳",
      "Had breakfast? Add what you ate when you have a moment.",
    ],
  ],
  lunch: [
    [
      "Lunch deserves a cameo 🍛",
      "Your lunch log is still empty. What made it onto your plate?",
    ],
    [
      "Plot twist: lunch happened 🍽️",
      "If you ate lunch, give it a spot in your diary.",
    ],
    [
      "Hey {name}, lunch check-in 👋",
      "A quick food note now saves the evening memory game.",
    ],
  ],
  dinner: [
    [
      "Dinner roll call 🌙",
      "What was on the menu? Your dinner diary is waiting.",
    ],
    [
      "One last food memory 🍲",
      "If dinner is done, log the delicious details.",
    ],
    [
      "Your evening, with a little spark ✨",
      "A tiny dinner check-in before you switch off.",
    ],
  ],
  water: [
    [
      "Bottle side quest 💧",
      "You have logged {water} ml today. Fancy a sip if you are thirsty?",
    ],
    [
      "Your water bottle says hi 💧",
      "{water} ml logged so far. Had more? Give your diary an update.",
    ],
    [
      "A refreshing pause 🫗",
      "A little water check-in, {name}. Log a sip you have had.",
    ],
  ],
  fitness: [
    [
      "The chair will understand 🚶",
      "A stretch or a short movement break, if it suits your day?",
    ],
    [
      "A little change of scenery 🌿",
      "Up for a gentle movement break, {name}? Rest days count too.",
    ],
    [
      "Side quest: uncurl 🧘",
      "Shoulders down. A little stretch if it feels good.",
    ],
  ],
  fitnessSteps: [
    [
      "A few more little adventures 👟",
      "{steps} steps recorded · {remaining} to your chosen goal. A short stroll if you feel like it?",
    ],
    [
      "Your step story is growing 🌱",
      "{steps} steps so far, {name}. Your chosen goal is {goal}.",
    ],
  ],
  stepHalf: [
    [
      "Halfway hooray! 🎉",
      "{steps} steps recorded—you passed halfway to your {goal}-step goal.",
    ],
    [
      "Look at you go 👟",
      "{steps} steps and halfway to your chosen goal. Little efforts add up.",
    ],
  ],
  stepGoal: [
    [
      "Goal met. Happy feet! 🎉",
      "{steps} steps recorded. Your {goal}-step goal is complete—enjoy the win.",
    ],
    [
      "Hooray, {name}! ✨",
      "Your watch/phone recorded {steps} steps. That is your chosen goal, done.",
    ],
  ],
  workout: [
    [
      "Workout spotted 👀",
      "{workout} · {minutes} minutes, recorded by your watch app. Open FitLens to review it—no need to log it twice.",
    ],
    [
      "Your movement made it here 👟",
      "{workout} · {minutes} minutes. Forgot to open FitLens? Your watch record is ready to review.",
    ],
  ],
};
