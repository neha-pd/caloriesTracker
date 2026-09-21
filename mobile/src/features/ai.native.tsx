import React, { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { Image, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Picker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import { decode } from "jpeg-js";
import { toByteArray } from "base64-js";
import { models, useLLMChatSession } from "react-native-executorch";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Icon,
  Meter,
  Page,
  Segments,
  T,
} from "./ui";
const consentKey = "fitlens:local-ai";
export default function AI() {
  const { mode: requestedMode, meal } = useLocalSearchParams<{
    mode?: string;
    meal?: string;
  }>();
  const mode = requestedMode;
  const focused = useIsFocused();
  const [enabled, setEnabled] = useState(false),
    [loaded, setLoaded] = useState(false),
    [model, setModel] = useState("450m"),
    [uri, setUri] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [raw, setRaw] = useState("");
  useEffect(() => {
    void AsyncStorage.getItem(consentKey).then((v) => {
      if (v) {
        const c = JSON.parse(v);
        setModel(c.model || "450m");
        setEnabled(c.enabled === true);
      }
      setLoaded(true);
    });
  }, []);
  const session = useLLMChatSession(
    model === "1.6b"
      ? models.llm.LFM2_5_VL_1_6B.XNNPACK_8DA4W
      : models.llm.LFM2_5_VL_450M.XNNPACK_8DA4W,
    {
      preventLoad: !loaded || !enabled || !focused,
      resetOnTurn: true,
      generationConfig: { maxNewTokens: 100, temperature: 0.1 },
    },
  );
  useEffect(() => {
    if (!focused) session.stop?.();
  }, [focused]);
  async function configure(value: boolean, next = model) {
    setModel(next);
    setEnabled(value);
    await AsyncStorage.setItem(
      consentKey,
      JSON.stringify({ enabled: value, model: next }),
    );
  }
  async function choose(camera: boolean) {
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
    )({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false });
    if (!result.canceled) {
      setUri(result.assets[0].uri);
      setSuggestions([]);
      setRaw("");
    }
  }
  async function recognize() {
    if (!uri || !session.sendMessage) return;
    setBusy(true);
    setError("");
    setSuggestions([]);
    try {
      const image = await Manipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { format: Manipulator.SaveFormat.JPEG, base64: true, compress: 0.85 },
      );
      const decoded = decode(toByteArray(image.base64!), { useTArray: true });
      const result = await session.sendMessage([
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
        'Identify only the visible foods in this meal. Return a JSON array of short common food names, up to 5 items, for example ["rice", "chicken", "broccoli"]. Do not estimate calories or portion sizes. If no food is visible return [].',
      ]);
      const content = result.messages
        .filter((m) => m.role === "assistant")
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ");
      setRaw(content);
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed))
          setSuggestions(
            parsed
              .filter(
                (x) => typeof x === "string" && x.length > 0 && x.length < 80,
              )
              .slice(0, 5),
          );
      }
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
      subtitle="LFM suggests food names. You confirm the food, preparation, and portion."
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
      {!enabled ? (
        <>
          <Art size={130} />
          <Card>
            <T bold size={20}>
              Bring your food lens offline
            </T>
            <T color={C.muted}>
              Download model files once over Wi-Fi. They use substantial
              storage; the larger model needs more memory. Your phone runs every
              scan locally.
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
            <Button
              secondary
              title={
                session.error ? "Cancel & retry setup" : "Disable local AI"
              }
              onPress={() => void configure(false)}
            />
          </Card>
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
                    Good light. A clear view. Your whole plate.
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
              {uri && (
                <Button
                  title={
                    busy ? "Looking at your meal…" : "Identify foods locally"
                  }
                  loading={busy}
                  disabled={!session.isReady}
                  onPress={() => void recognize()}
                />
              )}
              {busy && (
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
                    Choose a suggestion to match it to the food library. Nothing
                    is logged automatically.
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
              {raw && !suggestions.length && !busy && (
                <Banner text="No usable food suggestions this time. Try a clearer photo or search your food manually." />
              )}
            </>
          )}
        </>
      )}
      {error && <Banner error text={error} />}
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
