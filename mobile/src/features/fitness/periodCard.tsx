import React from "react";
import Svg, { Rect, Circle, Text as Text, Line } from "react-native-svg";
import { summarize } from "./domain";
type Summary = ReturnType<typeof summarize>;
export default function PeriodCard({
  svgRef,
  width,
  summary,
  title,
  light,
  nutrition,
  style = "rings",
}: {
  svgRef: React.RefObject<Svg | null>;
  width: number;
  summary: Summary;
  title: string;
  light: boolean;
  nutrition: boolean;
  style?: string;
}) {
  const bg = light ? "#f5f0e4" : "#11180f",
    ink = light ? "#182514" : "#f4f5ec",
    muted = light ? "#58644f" : "#aab79b",
    accent = light ? "#446420" : "#d1fa70",
    panel = light ? "#e2e6d5" : "#24321d";
  const label = (
    text: string,
    x: number,
    y: number,
    size = 14,
    color = ink,
  ) => (
    <Text x={x} y={y} fontFamily="sans-serif" fontSize={size} fill={color}>
      {text}
    </Text>
  );
  const stats = nutrition
    ? [
        [
          "EATEN",
          summary.foodDays ? Math.round(summary.eaten).toLocaleString() : "—",
          `${summary.foodDays} food-log days · kcal`,
        ],
        [
          "TOTAL BURN",
          summary.burnDays
            ? Math.round(summary.totalBurn).toLocaleString()
            : "—",
          `${summary.burnDays} covered days · kcal`,
        ],
        [
          "ACTIVE BURN",
          summary.activeDays
            ? Math.round(summary.activeBurn).toLocaleString()
            : "—",
          `${summary.activeDays} covered days · kcal`,
        ],
      ]
    : [
        ["FOOD LOGGED", String(summary.foodDays), "days of awareness"],
        [
          "MOVEMENT",
          String(Math.round(summary.minutes)),
          "recorded workout minutes",
        ],
        [
          "SHOWING UP",
          String(summary.activeDays),
          "days with active burn records",
        ],
      ];
  return (
    <Svg
      ref={svgRef}
      width={width}
      height={(width * 16) / 9}
      viewBox="0 0 360 640"
      accessibilityLabel={"Fitness share image " + title}
    >
      <Rect width={360} height={640} fill={bg} />
      <Circle cx={350} cy={15} r={180} fill={panel} />
      {label("FITKIN  /  MY RHYTHM", 28, 46, 11, accent)}
      {label(title, 28, 85, 21)}
      {label("Every little effort adds up.", 28, 111, 13, muted)}
      {style === "mosaic" ? (
        <>
          {summary.rows.length <= 31
            ? summary.rows.map((r, i) => {
                const offset = new Date(
                    summary.rows[0].date + "T12:00:00",
                  ).getDay(),
                  cell = i + offset;
                return (
                  <React.Fragment key={r.date}>
                    <Rect
                      x={30 + (cell % 7) * 43}
                      y={137 + Math.floor(cell / 7) * 31}
                      width={36}
                      height={25}
                      rx={6}
                      fill={
                        r.foods && r.activeCalories != null
                          ? accent
                          : r.foods
                            ? "#8ecfea"
                            : r.activeCalories != null
                              ? "#ff9f68"
                              : panel
                      }
                    />
                    {label(
                      String(Number(r.date.slice(-2))),
                      40 + (cell % 7) * 43,
                      154 + Math.floor(cell / 7) * 31,
                      11,
                      r.foods || r.activeCalories != null ? "#172110" : muted,
                    )}
                  </React.Fragment>
                );
              })
            : summary.rows
                .slice(0, 366)
                .map((r, i) => (
                  <Rect
                    key={r.date}
                    x={29 + (i % 21) * 14.4}
                    y={142 + Math.floor(i / 21) * 9}
                    width={11}
                    height={6}
                    rx={2}
                    fill={
                      r.foods && r.activeCalories != null
                        ? accent
                        : r.foods
                          ? "#8ecfea"
                          : r.activeCalories != null
                            ? "#ff9f68"
                            : panel
                    }
                  />
                ))}
          {label("Food + movement · recorded days only", 28, 328, 10, muted)}
        </>
      ) : (
        <>
          {[0, 1, 2].map((i) => (
            <Circle
              key={"track" + i}
              cx={180}
              cy={226}
              r={88 - i * 21}
              fill="none"
              stroke={panel}
              strokeWidth={12}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <Circle
              key={i}
              cx={180}
              cy={226}
              r={88 - i * 21}
              fill="none"
              stroke={[accent, "#ff9f68", "#8ecfea"][i]}
              strokeWidth={12}
              strokeDasharray={`${Math.min(1, [summary.foodDays, summary.activeDays, summary.rows.filter((r) => (r.exerciseMinutes || 0) > 0).length][i] / Math.max(1, summary.rows.length)) * 2 * Math.PI * (88 - i * 21)} ${2 * Math.PI * (88 - i * 21)}`}
              rotation={-90}
              origin="180,226"
            />
          ))}
          {label("MY DAYS", 155, 224, 11, muted)}
          {label(String(summary.foodDays), 163, 248, 25)}
        </>
      )}
      {stats.map((s, i) => (
        <React.Fragment key={s[0]}>
          <Rect
            x={26}
            y={350 + i * 61}
            width={308}
            height={54}
            rx={13}
            fill={panel}
          />
          {label(s[0], 39, 369 + i * 61, 9, muted)}
          {label(s[1], 39, 394 + i * 61, s[1].length > 7 ? 17 : 23)}
          {label(s[2], 149, 387 + i * 61, 10, muted)}
        </React.Fragment>
      ))}
      {label(
        `${Math.round(summary.minutes)} workout min · ${summary.workoutCount} logged sessions`,
        28,
        558,
        12,
        accent,
      )}
      {label(
        "Partial logs are not a calorie deficit calculation.",
        28,
        584,
        9,
        muted,
      )}
      {label("A little stronger. A little brighter.", 28, 612, 13)}
    </Svg>
  );
}
