import React from "react";
import Svg, { Circle, G, Path, Rect, Text as Label } from "react-native-svg";
import type { Entry, Nutrition } from "../types";
import { reportLayout, weightDistance, wrapLabel } from "./reportData";
type Props = {
  svgRef: React.RefObject<Svg | null>;
  width: number;
  light: boolean;
  date: string;
  entries: Entry[];
  workouts?: { name: string; minutes: number; source: string }[];
  totals: Nutrition;
  water: number;
  goal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  currentWeight: number | null;
  targetWeight: number | null;
  activeCalories: number | null;
  totalCalories?: number | null;
  steps: number | null;
  activityTime: string | null;
};
export default function ReportCard(p: Props) {
  const layout = reportLayout(p.entries, p.workouts?.length || 0),
    bg = p.light ? "#f4f0e5" : "#11180f",
    ink = p.light ? "#192414" : "#f4f5ec",
    muted = p.light ? "#596451" : "#aab79b",
    panel = p.light ? "#e6e8d7" : "#202d19",
    accent = p.light ? "#385321" : "#d1fa70";
  const text = (
    value: string | number,
    x: number,
    y: number,
    size = 11,
    color = ink,
    bold = false,
  ) => (
    <Label
      x={x}
      y={y}
      fill={color}
      fontSize={size}
      fontWeight={bold ? "700" : "400"}
      fontFamily="sans-serif"
    >
      {value}
    </Label>
  );
  const energyGap = Math.round(Math.abs(p.goal - p.totals.calories));
  return (
    <Svg
      ref={p.svgRef}
      width={p.width}
      height={(p.width * layout.height) / 360}
      viewBox={`0 0 360 ${layout.height}`}
      accessibilityLabel="Complete daily coach report"
    >
      <Rect width="360" height={layout.height} fill={bg} />
      <Circle cx="335" cy="40" r="155" fill={panel} />
      <Rect
        x="18"
        y="18"
        width="324"
        height={layout.height - 36}
        rx="22"
        fill="none"
        stroke={accent}
        strokeOpacity=".22"
      />
      {text("FITLENS / DAILY COACH REPORT", 34, 49, 9, accent, true)}
      {text("The whole picture.", 34, 91, 29, ink, true)}
      {text(p.date, 34, 117, 10, muted)}
      <Rect x="32" y="139" width="296" height="96" rx="16" fill={panel} />
      {text("ENERGY LOGGED", 46, 160, 8, muted, true)}
      {text(
        `${Math.round(p.totals.calories).toLocaleString()} kcal`,
        46,
        188,
        25,
        ink,
        true,
      )}
      {text(
        `Chosen target: ${p.goal.toLocaleString()} kcal`,
        46,
        207,
        11,
        accent,
      )}
      {text(
        `${energyGap} kcal ${p.totals.calories > p.goal ? "above" : "below"} target in this log`,
        46,
        224,
        9,
        muted,
      )}
      {text(
        `PROTEIN  ${Math.round(p.totals.protein_g)} / ${p.proteinGoal} g`,
        34,
        261,
        10,
        ink,
        true,
      )}
      {text(
        `CARBS  ${Math.round(p.totals.carbs_g)} / ${p.carbsGoal} g`,
        34,
        280,
        10,
        ink,
        true,
      )}
      {text(
        `FAT  ${Math.round(p.totals.fat_g)} / ${p.fatGoal} g`,
        34,
        299,
        10,
        ink,
        true,
      )}
      {text("WATER", 221, 260, 8, muted, true)}
      {text(`${p.water.toLocaleString()} ml`, 221, 282, 18, accent, true)}
      <Path d="M34 316H326" stroke={muted} strokeOpacity=".25" />
      {text("MOVEMENT / ACTIVITY", 34, 338, 9, accent, true)}
      {text(
        p.activeCalories == null
          ? "Active calories: not available"
          : `Active calories burned: ${Math.round(p.activeCalories)} kcal`,
        34,
        359,
        12,
        ink,
        true,
      )}
      {text(
        p.totalCalories == null
          ? "Total burn: not available"
          : `Total burned: ${Math.round(p.totalCalories)} kcal (includes active)`,
        34,
        377,
        10,
        ink,
        true,
      )}
      {text(
        p.steps == null
          ? "Steps: not available"
          : `${Math.round(p.steps).toLocaleString()} steps`,
        34,
        393,
        10,
        muted,
      )}
      {text(
        p.activityTime
          ? `Read ${p.activityTime} · device estimates may be incomplete`
          : "Connect health to import recorded activity.",
        34,
        409,
        8,
        muted,
      )}
      {text(
        `WEIGHT  ${p.currentWeight == null ? "Not set" : p.currentWeight + " kg"}  →  TARGET  ${p.targetWeight == null ? "Not set" : p.targetWeight + " kg"}`,
        34,
        443,
        11,
        ink,
        true,
      )}
      {text(weightDistance(p.currentWeight, p.targetWeight), 34, 462, 9, muted)}
      {layout.rows.map((row, i) =>
        row.kind === "heading" ? (
          <G key={i}>{text(row.label, 34, row.y, 10, accent, true)}</G>
        ) : (
          <G key={i}>
            <Rect
              x="32"
              y={row.y - 12}
              width="296"
              height={row.height}
              rx="12"
              fill={panel}
            />
            {row.lines.map((line, j) => (
              <G key={j}>{text(line, 44, row.y + 5 + j * 16, 11, ink, true)}</G>
            ))}
            {text(
              `${Math.round(row.entry.quantity * 100) / 100} × ${row.entry.serving_unit}`.slice(
                0,
                48,
              ),
              44,
              row.y + row.lines.length * 16 + 8,
              9,
              muted,
            )}
            {text(
              `${Math.round(row.entry.calories)} kcal  ·  P ${Math.round(row.entry.protein_g)}g  C ${Math.round(row.entry.carbs_g)}g  F ${Math.round(row.entry.fat_g)}g`,
              44,
              row.y + row.lines.length * 16 + 23,
              9,
              accent,
            )}
          </G>
        ),
      )}
      {!p.entries.length &&
        text("No foods logged for this date.", 34, 495, 12, muted)}
      {p.workouts?.map((w, i) => (
        <G key={i}>
          {text(
            w.name.slice(0, 42),
            34,
            layout.workoutY + i * 48,
            12,
            ink,
            true,
          )}
          {text(
            `${Math.round(w.minutes)} min · ${w.source}`.slice(0, 55),
            34,
            layout.workoutY + i * 48 + 17,
            9,
            muted,
          )}
        </G>
      ))}
      {text(
        "LOGGED DATA, NOT A PRESCRIPTION",
        34,
        layout.footerY,
        8,
        accent,
        true,
      )}
      {text(
        "Missing entries may make this report incomplete.",
        34,
        layout.footerY + 18,
        9,
        muted,
      )}
      {text(
        "Weight is your latest profile entry, not a dated weigh-in.",
        34,
        layout.footerY + 34,
        8,
        muted,
      )}
      {text(
        "A safe pace or exercise requirement cannot be inferred here.",
        34,
        layout.footerY + 49,
        8,
        muted,
      )}
    </Svg>
  );
}
