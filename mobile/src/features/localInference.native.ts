import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Device from "expo-device";
import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  models,
  useResourceDownload,
  createLLMChatSession,
  type LLMChatSession,
} from "react-native-executorch";
import { assistantText } from "./aiDomain";
type Input = Parameters<LLMChatSession["sendMessage"]>[0];
export type Turn = { role: "user" | "assistant"; content: string };
const GiB = 1024 ** 3;
const memoryInfo =
  Platform.OS === "android"
    ? requireOptionalNativeModule("FitLensVoice")
    : null;
let occupied = false;
export function useLocalInference(
  active: boolean,
  kind: "vision" | "chat" = "vision",
) {
  const key = kind === "chat" ? "fitlens:conversation-ai" : "fitlens:local-ai";
  const [config, setConfig] = useState({
    enabled: false,
    model:
      kind === "chat"
        ? "1.2b"
        : (Device.totalMemory ?? 0) >= 6.5 * GiB
          ? "1.6b"
          : "450m",
  });
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const alive = useRef(active),
    epoch = useRef(0),
    running = useRef<LLMChatSession | null>(null);
  alive.current = active;
  const stop = () => {
    epoch.current++;
    running.current?.stop();
  };
  useEffect(() => {
    alive.current = active;
    let valid = true;
    if (active)
      void AsyncStorage.getItem(key)
        .then((raw) => {
          if (!valid) return;
          try {
            if (raw) {
              const saved = JSON.parse(raw);
              const allowed =
                kind === "chat" ? ["350m", "1.2b"] : ["450m", "1.6b"];
              if (
                saved &&
                typeof saved.enabled === "boolean" &&
                allowed.includes(saved.model)
              )
                setConfig(saved);
            }
          } catch {}
          setLoaded(true);
        })
        .catch(() => {
          if (valid) setLoaded(true);
        });
    if (!active) stop();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      valid = false;
      alive.current = false;
      stop();
      listener.remove();
    };
  }, [active, key]);
  const choice =
    kind === "chat"
      ? config.model === "350m"
        ? models.llm.LFM2_5_350M.XNNPACK_8DA4W
        : models.llm.LFM2_5_1_2B.XNNPACK_8DA4W
      : config.model === "1.6b"
        ? models.llm.LFM2_5_VL_1_6B.XNNPACK_8DA4W
        : models.llm.LFM2_5_VL_450M.XNNPACK_8DA4W;
  const unsupported =
    kind === "vision" &&
    config.model === "1.6b" &&
    (Device.totalMemory ?? 0) < 6.5 * GiB;
  const download = useResourceDownload(choice, {
    preventLoad: !active || !loaded || !config.enabled || unsupported,
  });
  async function configure(enabled: boolean, model = config.model) {
    stop();
    if (
      enabled &&
      kind === "vision" &&
      model === "1.6b" &&
      (Device.totalMemory ?? 0) < 6.5 * GiB
    )
      throw new Error(
        "Enhanced vision needs an 8 GB-class phone. Choose Compact to avoid running out of memory.",
      );
    await AsyncStorage.setItem(key, JSON.stringify({ enabled, model }));
    setConfig({ enabled, model });
  }
  async function generate(
    input: Input,
    options: {
      system?: string;
      history?: Turn[];
      onToken?: (token: string) => void;
      maxTokens?: number;
    } = {},
  ) {
    if (!alive.current || !config.enabled || !download.resource)
      throw new Error("Finish downloading the local model first.");
    if (occupied)
      throw new Error(
        "The local model is finishing another request. Try again in a moment.",
      );
    const available = memoryInfo?.memory()?.availableBytes;
    const needed =
      kind === "vision" && config.model === "1.6b"
        ? 3.2 * GiB
        : kind === "chat" && config.model === "1.2b"
          ? 1.1 * GiB
          : 0.8 * GiB;
    if (typeof available === "number" && available < needed)
      throw new Error(
        "Not enough free memory to run this model safely. Close other apps or choose a lighter model.",
      );
    occupied = true;
    setBusy(true);
    const request = ++epoch.current;
    let session: LLMChatSession | undefined,
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, 120000);
    try {
      // Fresh session: resetOnTurn resets KV cache, not retained photo/history messages.
      session = await createLLMChatSession(download.resource, {
        initialMessages: [
          ...(options.system
            ? [{ role: "system" as const, content: options.system }]
            : []),
          ...(options.history ?? []).slice(-6),
        ],
        generationConfig: {
          maxNewTokens: options.maxTokens ?? 260,
          temperature: 0.25,
        },
      });
      running.current = session;
      if (request !== epoch.current || !alive.current)
        throw new Error("Request stopped.");
      const result = await session.sendMessage(input, (token) => {
        if (request === epoch.current && alive.current)
          options.onToken?.(token);
      });
      if (timedOut)
        throw new Error(
          "This phone took too long to answer. Try the compact model or a shorter question.",
        );
      if (request !== epoch.current || !alive.current)
        throw new Error("Request stopped.");
      const text = assistantText(result.messages);
      if (!text)
        throw new Error(
          "The model returned an empty answer. Retry, or change the model in AI settings.",
        );
      return text;
    } finally {
      clearTimeout(timer);
      try {
        session?.dispose();
      } finally {
        running.current = null;
        occupied = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  return {
    enabled: config.enabled,
    model: config.model,
    loaded,
    ready: active && config.enabled && !unsupported && !!download.resource,
    progress: download.downloadProgress,
    error:
      unsupported && config.enabled
        ? new Error(
            "Enhanced vision needs an 8 GB-class phone. Disable it and select Compact.",
          )
        : download.downloadError,
    busy,
    configure,
    generate,
    stop,
  };
}
