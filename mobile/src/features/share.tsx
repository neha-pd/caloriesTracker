import React, { useRef, useState } from "react";
import { Platform, Switch, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as Label,
} from "react-native-svg";
import { useLocalSearchParams, router } from "expo-router";
import { useHealth } from "./health/store";
import { localDateKey } from "../lib/dates";
import ReportCard from "./coach/reportCard";
import { reportLayout } from "./coach/reportData";
import { toByteArray } from "base64-js";
import { Banner, Button, C, Card, Page, S, Segments, T } from "./ui";
import { useTracker, totalNutrition } from "./tracker";
import { useAuthStore } from "../store/authStore";

export default function ShareDay() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState(
    params.mode === "report" ? "report" : "story",
  );
  const health = useHealth();
  const tracker = useTracker(),
    user = useAuthStore((s) => s.user),
    svg = useRef<Svg>(null);
  const [theme, setTheme] = useState("midnight"),
    [nutrition, setNutrition] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const width = Math.min(useWindowDimensions().width - 48, 420);
  const entries = tracker.entries.filter(
    (e) => e.log_date === tracker.date && !e.deleted_at,
  );
  const totals = totalNutrition(entries),
    water = tracker.water
      .filter((w) => w.log_date === tracker.date && !w.deleted_at)
      .reduce((sum, w) => sum + w.amount_ml, 0);
  const light = theme === "cream",
    bg = light ? "#f4f0e5" : "#11180f",
    ink = light ? "#192414" : "#f4f5ec",
    muted = light ? "#596451" : "#aab79b",
    panel = light ? "#e6e8d7" : "#202d19",
    accent = light ? "#385321" : "#d1fa70";
  const demo = user?.id === "fitlens-offline-demo";
  const date =
    (demo ? "DEMO · " : "") +
    new Date(tracker.date + "T12:00:00")
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
  const progress = Math.min(1, totals.calories / (user?.calorie_goal || 2000));
  const report = mode === "report";
  const height = report ? reportLayout(entries).height : 640;
  const activityAvailable =
    health.enabled &&
    tracker.date === localDateKey() &&
    !!health.lastSync &&
    localDateKey(new Date(health.lastSync)) === tracker.date;
  async function exportCard(download = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error("The image could not be prepared. Please try again."),
            ),
          15000,
        );
        if (!svg.current) {
          clearTimeout(timeout);
          reject(new Error("The preview is still loading."));
          return;
        }
        svg.current.toDataURL(
          (data) => {
            clearTimeout(timeout);
            data
              ? resolve(data)
              : reject(new Error("Could not render the image."));
          },
          { width: 1080, height: height * 3 },
        );
      });
      const filename = `fitlens-${tracker.date}${report ? "-coach" : ""}.png`;
      if (Platform.OS === "web") {
        const bytes = toByteArray(base64);
        const file = new globalThis.File([bytes as BlobPart], filename, {
          type: "image/png",
        });
        if (!download && navigator.canShare?.({ files: [file] }))
          await navigator.share({ files: [file] });
        else {
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          setMessage(
            "Image downloaded. Add it to your Instagram Story or WhatsApp Status.",
          );
        }
      } else {
        const fs = await import("expo-file-system"),
          sharing = await import("expo-sharing");
        if (!(await sharing.isAvailableAsync()))
          throw new Error("Sharing is not available on this device.");
        const file = new fs.File(fs.Paths.cache, filename);
        file.write(toByteArray(base64));
        await sharing.shareAsync(file.uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: "Share your daily spark",
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(
        e instanceof Error
          ? e.message
          : "Could not share your image. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="A LITTLE WIN WORTH SHARING"
      title="Your day. Your story."
      subtitle={
        report
          ? "Your full diary and targets in one image to share with your coach."
          : "A story-sized keepsake of your daily spark."
      }
    >
      <Segments
        values={[
          { key: "story", label: "Daily story" },
          { key: "report", label: "Coach report" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {report && (
        <>
          <Banner text="Includes all foods logged for this date, your latest profile weight, and activity when available. Preview your details before sharing." />
          <Button
            secondary
            title="Edit weight & target"
            onPress={() => router.push("/edit-profile")}
          />
        </>
      )}
      <Segments
        values={[
          { key: "midnight", label: "Midnight" },
          { key: "cream", label: "Soft cream" },
        ]}
        value={theme}
        onChange={setTheme}
      />
      <View
        testID="share-card"
        style={{
          alignSelf: "center",
          width,
          height: (width * height) / 360,
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        {report ? (
          <ReportCard
            svgRef={svg}
            width={width}
            light={light}
            date={date}
            entries={entries}
            totals={totals}
            water={water}
            goal={user?.calorie_goal || 2000}
            proteinGoal={user?.protein_goal_g || 100}
            carbsGoal={user?.carbs_goal_g || 250}
            fatGoal={user?.fat_goal_g || 67}
            currentWeight={user?.weight_kg ?? null}
            targetWeight={user?.weight_goal_kg ?? null}
            activeCalories={activityAvailable ? health.activeCalories : null}
            steps={activityAvailable ? health.steps : null}
            activityTime={
              activityAvailable
                ? new Date(health.lastSync!).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null
            }
          />
        ) : (
          <Svg
            ref={svg}
            width={width}
            height={(width * 16) / 9}
            viewBox="0 0 360 640"
            accessibilityLabel={`Daily share image for ${tracker.date}`}
          >
            <Defs>
              <LinearGradient id="flame" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffd889" />
                <Stop offset=".5" stopColor="#ff9e42" />
                <Stop offset="1" stopColor="#ef632b" />
              </LinearGradient>
            </Defs>
            <Rect width="360" height="640" fill={bg} />
            <Circle cx="335" cy="100" r="180" fill={panel} />
            <Circle cx="-55" cy="540" r="145" fill={panel} />
            <Rect
              x="24"
              y="25"
              width="312"
              height="590"
              rx="24"
              fill="none"
              stroke={accent}
              strokeOpacity=".22"
            />
            <Label
              x="44"
              y="60"
              fill={accent}
              fontSize="11"
              fontWeight="800"
              letterSpacing="2"
              fontFamily="sans-serif"
            >
              FITLENS
            </Label>
            <Label
              x="316"
              y="60"
              textAnchor="end"
              fill={muted}
              fontSize="8"
              letterSpacing="1"
              fontFamily="sans-serif"
            >
              MY DAILY SPARK
            </Label>
            <Label
              x="44"
              y="122"
              fill={ink}
              fontSize="38"
              fontWeight="800"
              letterSpacing="-1.6"
              fontFamily="sans-serif"
            >
              Little wins.
            </Label>
            <Label
              x="44"
              y="166"
              fill={ink}
              fontSize="38"
              fontWeight="800"
              letterSpacing="-1.6"
              fontFamily="sans-serif"
            >
              Brighter days.
            </Label>
            <Label
              x="45"
              y="194"
              fill={muted}
              fontSize="9"
              letterSpacing="1.1"
              fontFamily="sans-serif"
            >
              {date}
            </Label>
            <G transform="translate(277 107) scale(.65)">
              <Path
                d="M 0 64 C -27 60 -28 34 -13 18 C -13 34 -2 25 0 0 C 25 18 20 32 28 27 C 38 47 26 67 8 68 Z"
                fill="url(#flame)"
              />
              <Circle cx="0" cy="43" r="2.5" fill="#48200d" />
              <Circle cx="15" cy="43" r="2.5" fill="#48200d" />
              <Path
                d="M 4 51 Q 8 56 12 51"
                fill="none"
                stroke="#48200d"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </G>
            <Circle
              cx="180"
              cy="306"
              r="77"
              fill={panel}
              stroke={accent}
              strokeOpacity=".15"
              strokeWidth="7"
            />
            <Circle
              cx="180"
              cy="306"
              r="77"
              fill="none"
              stroke={accent}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(nutrition ? progress : Math.min(entries.length / 4, 1)) * 484} 484`}
              rotation="-90"
              origin="180,306"
            />
            <Label
              x="180"
              y="293"
              textAnchor="middle"
              fill={muted}
              fontSize="9"
              letterSpacing="1.8"
              fontFamily="sans-serif"
            >
              {nutrition ? "ENERGY LOGGED" : "FOODS LOGGED"}
            </Label>
            <Label
              x="180"
              y="334"
              textAnchor="middle"
              fill={ink}
              fontSize="43"
              fontWeight="800"
              letterSpacing="-2"
              fontFamily="sans-serif"
            >
              {nutrition
                ? Math.round(totals.calories).toLocaleString()
                : entries.length}
            </Label>
            <Label
              x="180"
              y="356"
              textAnchor="middle"
              fill={muted}
              fontSize="10"
              fontFamily="sans-serif"
            >
              {nutrition ? "kcal logged" : "little moments of awareness"}
            </Label>
            {nutrition && (
              <G>
                {[
                  {
                    x: 87,
                    label: "PROTEIN",
                    value: totals.protein_g,
                    color: light ? "#ad572d" : "#ffb78d",
                  },
                  {
                    x: 180,
                    label: "CARBS",
                    value: totals.carbs_g,
                    color: light ? "#347082" : "#9dd5e8",
                  },
                  {
                    x: 273,
                    label: "FAT",
                    value: totals.fat_g,
                    color: light ? "#74609e" : "#cbbbff",
                  },
                ].map((m) => (
                  <G key={m.label}>
                    <Label
                      x={m.x}
                      y="418"
                      textAnchor="middle"
                      fill={m.color}
                      fontWeight="700"
                      fontSize="21"
                      fontFamily="sans-serif"
                    >
                      {Math.round(m.value)}g
                    </Label>
                    <Label
                      x={m.x}
                      y="436"
                      textAnchor="middle"
                      fill={muted}
                      fontSize="8"
                      letterSpacing="1"
                      fontFamily="sans-serif"
                    >
                      {m.label}
                    </Label>
                  </G>
                ))}
              </G>
            )}
            {!nutrition && (
              <>
                <Label
                  x="180"
                  y="413"
                  textAnchor="middle"
                  fill={accent}
                  fontWeight="700"
                  fontSize="17"
                  fontFamily="sans-serif"
                >
                  Showing up is a win.
                </Label>
                <Label
                  x="180"
                  y="434"
                  textAnchor="middle"
                  fill={muted}
                  fontSize="11"
                  fontFamily="sans-serif"
                >
                  One small habit at a time.
                </Label>
              </>
            )}
            <Rect x="43" y="461" width="274" height="70" rx="18" fill={panel} />
            <Label
              x="111"
              y="490"
              textAnchor="middle"
              fill={ink}
              fontSize="21"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              {(water / 1000).toFixed(1)} L
            </Label>
            <Label
              x="111"
              y="510"
              textAnchor="middle"
              fill={muted}
              fontSize="8"
              letterSpacing="1"
              fontFamily="sans-serif"
            >
              WATER LOGGED
            </Label>
            <Path d="M180 477V516" stroke={muted} strokeOpacity=".25" />
            <Label
              x="249"
              y="490"
              textAnchor="middle"
              fill={ink}
              fontSize="21"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              {tracker.progress.streak}{" "}
              {tracker.progress.streak === 1 ? "day" : "days"}
            </Label>
            <Label
              x="249"
              y="510"
              textAnchor="middle"
              fill={muted}
              fontSize="8"
              letterSpacing="1"
              fontFamily="sans-serif"
            >
              CURRENT STREAK
            </Label>
            <Label
              x="180"
              y="565"
              textAnchor="middle"
              fill={ink}
              fontSize="11"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              Progress feels better with a little spark.
            </Label>
            <Label
              x="180"
              y="587"
              textAnchor="middle"
              fill={muted}
              fontSize="8"
              letterSpacing="1.2"
              fontFamily="sans-serif"
            >
              MY DAY, WITH FITLENS
            </Label>
          </Svg>
        )}
      </View>
      {!report && (
        <Card>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <T bold>Include calories & macros</T>
              <T size={12} color={C.muted}>
                Turn off for a habits-only story.
              </T>
            </View>
            <Switch
              accessibilityLabel="Include calories and macros"
              value={nutrition}
              onValueChange={setNutrition}
              trackColor={{ true: C.lime, false: C.border }}
            />
          </View>
        </Card>
      )}
      {error && <Banner text={error} error />}
      {message && <Banner text={message} />}
      <Button
        title={Platform.OS === "web" ? "Share image" : "Share or save image"}
        icon="share-outline"
        onPress={() => void exportCard()}
        loading={busy}
        testID="share-image"
      />
      {Platform.OS === "web" && (
        <Button
          secondary
          title={report ? "Download coach report" : "Download story image"}
          onPress={() => void exportCard(true)}
          disabled={busy}
          testID="download-story"
        />
      )}
      <T size={12} color={C.muted}>
        {report
          ? `1080 × ${height * 3} PNG · Full diary report. Longer diaries produce a taller image. `
          : "1080 × 1920 PNG · Instagram Story / WhatsApp Status size. "}
        Choose an app in your phone’s share sheet, or save the image and add it
        to your story. Nothing posts automatically.
      </T>
    </Page>
  );
}
