import React, { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { Image, View, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Picker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import { decode } from "jpeg-js";
import { toByteArray } from "base64-js";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useLocalInference } from "./localInference.native";
import { foodPrompt, parseFoodSuggestions } from "./aiDomain";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Icon,
  Field,
  Meter,
  Page,
  Segments,
  T,
} from "./ui";
const foodModel =
  Platform.OS === "android" ? requireOptionalNativeModule("FitLensFood") : null;
export default function AI() {
  const { mode: requestedMode, meal } = useLocalSearchParams<{
    mode?: string;
    meal?: string;
  }>();
  const mode = requestedMode;
  const [engine, setEngine] = useState(foodModel ? "fast" : "lfm");
  const fast = engine === "fast";
  const focused = useIsFocused();
  const [enabled, setEnabled] = useState(false),
    [model, setModel] = useState("1.6b"),
    [uri, setUri] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [raw, setRaw] = useState(""),
    [hint, setHint] = useState("");
  const inference = useLocalInference(focused && !fast);
  const session = {
    isReady: inference.ready,
    error: inference.error,
    downloadProgress: inference.progress,
    stop: inference.stop,
  };
  useEffect(() => {
    setEnabled(inference.enabled);
    setModel(inference.model);
  }, [inference.enabled, inference.model]);
  async function configure(value: boolean, next = model) {
    try {
      await inference.configure(value, next);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save AI settings. Try again.",
      );
    }
  }
  async function choose(camera: boolean) {
    try {
      setError("");
      const permission = camera
        ? await Picker.requestCameraPermissionsAsync()
        : await Picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          `Allow ${camera ? "camera" : "photo"} access in device settings, or search foods manually.`,
        );
        return;
      }
      const result = await (
        camera ? Picker.launchCameraAsync : Picker.launchImageLibraryAsync
      )({ mediaTypes: ["images"], quality: 0.8, allowsEditing: fast });
      if (!result.canceled) {
        setUri(result.assets[0].uri);
        setSuggestions([]);
        setRaw("");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not open camera or photos. Check device permissions.",
      );
    }
  }
  async function recognize() {
    if (!uri || (!fast && !inference.ready) || busy) return;
    setBusy(true);
    setError("");
    setSuggestions([]);
    setRaw("");
    try {
      const image = await Manipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { format: Manipulator.SaveFormat.JPEG, base64: true, compress: 0.85 },
      );
      if (fast) {
        const result: { index: number; name: string; score: number }[] =
          await foodModel!.classify(image.base64!);
        const top = result[0];
        if (!top || top.index === 0 || top.score < 0.15) {
          setRaw(
            "No strong match. Crop around one dish, try another angle, or search its name.",
          );
          return;
        }
        setSuggestions(
          result
            .filter((r) => r.index !== 0 && r.score >= 0.03)
            .slice(0, 3)
            .map((r) => r.name),
        );
        setRaw(
          "These are alternative matches for one dish, not a list of everything on your plate. The model has a fixed food vocabulary and can miss regional dishes.",
        );
        return;
      }
      const decoded = decode(toByteArray(image.base64!), { useTArray: true });
      const content = await inference.generate(
        [
          {
            kind: "image",
            image: {
              data: new Uint8Array(decoded.data),
              width: decoded.width,
              height: decoded.height,
              format: "rgba",
              layout: "hwc",
            },
          },
          foodPrompt +
            (hint.trim()
              ? ` The user says this meal is from this cuisine or has these known details: ${JSON.stringify(hint.slice(0, 120))}. Use this only as a hint; still inspect the image.`
              : ""),
        ],
        { maxTokens: 220 },
      );
      setRaw(content);
      setSuggestions(parseFoodSuggestions(content));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not recognize this meal. Try another photo or search manually.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="PRIVATE BY DESIGN"
      title={
        mode === "settings"
          ? "A little intelligence.\nAll on your device."
          : "Snap a little\nfood story."
      }
      subtitle="Find a dish, review the match, then choose your portion."
    >
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Icon name="shield-checkmark-outline" size={30} />
          <View style={{ flex: 1 }}>
            <T bold>Photos stay on this device.</T>
            <T size={13} color={C.muted}>
              No AI API key. No cloud inference.
            </T>
          </View>
        </View>
      </Card>
      {foodModel && (
        <Segments
          values={[
            { key: "fast", label: "Quick food lens" },
            { key: "lfm", label: "LFM vision · optional" },
          ]}
          value={engine}
          onChange={(v) => {
            if (!busy) {
              setEngine(v);
              setSuggestions([]);
              setRaw("");
              setError("");
            }
          }}
        />
      )}
      {fast && (
        <Card>
          <T bold>Food lens ready · works offline</T>
          <T color={C.muted}>
            Google AIY is included in the app. Crop around one dish for the best
            result. Review each match: some regional foods, including dosa, are
            missing from its vocabulary.
          </T>
          <T size={12} color={C.muted}>
            Google AIY Food V1 · Apache 2.0 · no model download or API key.
          </T>
        </Card>
      )}
      {!fast && !enabled ? (
        <>
          <Art size={130} />
          <Card>
            <T bold size={20}>
              Bring your food lens offline
            </T>
            <T color={C.muted}>
              Download model files once over Wi-Fi. Compact needs about 650 MB;
              enhanced needs about 2.5 GB and an 8 GB-class phone. Your phone
              runs every scan locally.
            </T>
            <Segments
              values={[
                { key: "450m", label: "LFM · Compact" },
                { key: "1.6b", label: "LFM · Enhanced" },
              ]}
              value={model}
              onChange={setModel}
            />
            <Button
              title="Download & enable local AI"
              onPress={() => void configure(true)}
            />
          </Card>
        </>
      ) : (
        <>
          {!fast && (
            <Card>
              <T bold>
                {session.isReady
                  ? "Ready for your next meal"
                  : session.error
                    ? "Model needs attention"
                    : `Preparing LFM · ${Math.round(session.downloadProgress)}%`}
              </T>
              <Meter value={session.isReady ? 100 : session.downloadProgress} />
              <T color={C.muted} size={12}>
                {model === "450m"
                  ? "Compact · 450M parameters"
                  : "Enhanced · 1.6B parameters"}{" "}
                · downloaded files are reused offline
              </T>
              {session.error && <Banner error text={session.error.message} />}
              <Segments
                values={[
                  { key: "450m", label: "Compact · faster" },
                  { key: "1.6b", label: "Enhanced · more detail" },
                ]}
                value={model}
                onChange={(v) => {
                  if (!busy) void configure(false, v);
                }}
              />
              <T color={C.muted} size={12}>
                Changing model asks you to enable its download. Enhanced needs
                more memory; a larger model can still misidentify dishes.
              </T>
              <Button
                secondary
                disabled={busy}
                title={
                  session.error ? "Cancel & retry setup" : "Disable local AI"
                }
                onPress={() => void configure(false)}
              />
            </Card>
          )}
          {mode !== "settings" && (
            <>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: 280, borderRadius: 22 }}
                  accessibilityLabel="Selected meal photo"
                />
              ) : (
                <Card style={{ alignItems: "center", paddingVertical: 45 }}>
                  <Icon name="camera-outline" size={65} />
                  <T color={C.muted}>
                    Good light. A clear view. One dish at a time.
                  </T>
                </Card>
              )}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Take photo"
                    disabled={busy}
                    onPress={() => void choose(true)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Choose photo"
                    secondary
                    disabled={busy}
                    onPress={() => void choose(false)}
                  />
                </View>
              </View>
              {uri && !fast && (
                <Field
                  label="Optional cuisine or dish hint"
                  placeholder="For example: South Indian breakfast"
                  value={hint}
                  onChange={setHint}
                />
              )}
              {uri && (
                <Button
                  title={
                    busy ? "Looking at your meal…" : "Identify foods locally"
                  }
                  loading={busy}
                  disabled={!fast && !session.isReady}
                  onPress={() => void recognize()}
                />
              )}
              {busy && !fast && (
                <Button
                  secondary
                  title="Stop recognition"
                  onPress={() => session.stop?.()}
                />
              )}
              {suggestions.length > 0 && (
                <Card>
                  <T bold size={20}>
                    Does this look right?
                  </T>
                  <T color={C.muted}>
                    Choose the best match, then review it in the food library.
                    Nothing is logged automatically.
                  </T>
                  {suggestions.map((name, i) => (
                    <Button
                      key={i}
                      secondary
                      title={`Review ${name}`}
                      onPress={() =>
                        router.push({
                          pathname: "/log",
                          params: {
                            query: name,
                            source: "on_device",
                            meal: meal || "lunch",
                          },
                        })
                      }
                    />
                  ))}
                </Card>
              )}
              {raw && !busy && (
                <Card>
                  <T bold>What the food model saw</T>
                  <T color={C.muted}>{raw}</T>
                </Card>
              )}
              {raw && !suggestions.length && !busy && (
                <Banner text="No confirmed match. Try a closer crop or search the dish name manually." />
              )}
            </>
          )}
        </>
      )}
      {error && <Banner error text={error} />}
      <Button
        secondary
        title="Talk to Ember · voice & chat"
        onPress={() => router.push("/chat")}
      />
      <Button
        secondary
        title="Search food manually"
        onPress={() => router.push("/log")}
      />
      <T color={C.muted} size={12}>
        Recognition can be wrong, especially for mixed dishes. Confirm every
        ingredient and portion. Disabling AI stops loading it; downloaded files
        remain in app storage.
      </T>
    </Page>
  );
}
