import type { Entry } from "../types";
export function wrapLabel(text: string, max = 40) {
  const words = text.trim().split(/\s+/),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > max) {
      if (line) {
        lines.push(line);
        line = "";
      }
      for (let i = 0; i < word.length; i += max)
        lines.push(word.slice(i, i + max));
    } else if ((line + " " + word).trim().length > max) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["Food entry"];
}
export function reportLayout(entries: Entry[]) {
  let y = 480;
  const rows: (
    | { kind: "heading"; label: string; y: number }
    | { kind: "food"; entry: Entry; lines: string[]; y: number; height: number }
  )[] = [];
  for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
    const selected = entries.filter((e) => e.meal_type === meal);
    if (!selected.length) continue;
    rows.push({ kind: "heading", label: meal.toUpperCase(), y });
    y += 26;
    for (const entry of selected) {
      const lines = wrapLabel(entry.name),
        height = lines.length * 16 + 43;
      rows.push({ kind: "food", entry, lines, y, height });
      y += height + 8;
    }
    y += 12;
  }
  if (!entries.length) y += 40;
  return { rows, height: Math.max(720, y + 100), footerY: y + 20 };
}
export function weightDistance(
  current: number | null | undefined,
  target: number | null | undefined,
) {
  if (current == null || target == null)
    return "Add current and target weight in your profile.";
  const gap = Math.round(Math.abs(current - target) * 10) / 10;
  if (gap === 0) return "At your chosen target weight.";
  return `${gap} kg ${current > target ? "above" : "below"} your chosen target.`;
}
