export type Turn = { role: "user" | "assistant"; content: string };
export function useLocalInference(
  _active: boolean,
  _kind: "vision" | "chat" = "vision",
) {
  return {
    enabled: false,
    model: "1.2b",
    loaded: true,
    ready: false,
    progress: 0,
    error: undefined as Error | undefined,
    busy: false,
    configure: async (_enabled: boolean, _model?: string) => {},
    stop: () => {},
    generate: async (
      _input: string,
      _options?: {
        system?: string;
        history?: Turn[];
        onToken?: (token: string) => void;
        maxTokens?: number;
      },
    ): Promise<string> => {
      throw new Error("On-device AI runs in the native phone app.");
    },
  };
}
