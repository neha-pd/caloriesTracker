import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { models, useLLMChatSession } from "react-native-executorch";
export function useLocalCoach(active: boolean) {
  const [config, setConfig] = useState<{
    enabled: boolean;
    model: string;
  } | null>(null);
  useEffect(() => {
    let current = true;
    if (active)
      void AsyncStorage.getItem("fitlens:local-ai").then((raw) => {
        if (!current) return;
        try {
          setConfig(raw ? JSON.parse(raw) : { enabled: false, model: "450m" });
        } catch {
          setConfig({ enabled: false, model: "450m" });
        }
      });
    return () => {
      current = false;
    };
  }, [active]);
  const session = useLLMChatSession(
    config?.model === "1.6b"
      ? models.llm.LFM2_5_VL_1_6B.XNNPACK_8DA4W
      : models.llm.LFM2_5_VL_450M.XNNPACK_8DA4W,
    {
      preventLoad: !active || !config?.enabled,
      resetOnTurn: true,
      generationConfig: { maxNewTokens: 180, temperature: 0.1 },
    },
  );
  return {
    enabled: !!config?.enabled,
    ready: session.isReady,
    progress: session.downloadProgress,
    error: session.error,
    stop: () => session.stop?.(),
    generate: async (prompt: string) => {
      if (!session.sendMessage)
        throw new Error("The local model is still loading.");
      const result = await session.sendMessage(prompt);
      return result.messages
        .filter((m) => m.role === "assistant")
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join(" ");
    },
  };
}
