import type { Progress } from "./types";
export function xpReward(
  op: { url: string; method: string; body?: any },
  keys: string[],
  today: string,
) {
  const seen = new Set(keys),
    awards: { key: string; amount: number }[] = [];
  if (
    op.method === "put" &&
    op.url.startsWith("/api/v2/entries/") &&
    op.body?.log_date === today
  ) {
    if (keys.filter((k) => k.startsWith("food:")).length < 20)
      awards.push({ key: "food:" + op.body.id, amount: 10 });
    awards.push({ key: "meal:" + op.body.meal_type, amount: 25 });
  }
  if (
    op.method === "put" &&
    op.url.startsWith("/api/v2/water/") &&
    op.body?.log_date === today
  )
    awards.push({ key: "hydration", amount: 15 });
  if (op.method === "post" && op.url === "/api/v2/check-in")
    awards.push({ key: "check-in", amount: 10 });
  const fresh = awards.filter((a) => !seen.has(a.key));
  return {
    amount: fresh.reduce((n, a) => n + a.amount, 0),
    keys: fresh.map((a) => a.key),
  };
}
export function withXp(progress: Progress, delta: number): Progress {
  const xp = Math.max(0, progress.xp + delta);
  return {
    ...progress,
    xp,
    level: Math.floor(xp / 250) + 1,
    progress: xp % 250,
  };
}

export function xpStreak(dates: string[], today: string) {
  const seen = new Set(dates);
  let day = new Date(today + "T12:00:00"),
    count = 0;
  const key = () =>
    day.getFullYear() +
    "-" +
    String(day.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(day.getDate()).padStart(2, "0");
  if (!seen.has(key())) day.setDate(day.getDate() - 1);
  while (seen.has(key())) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
