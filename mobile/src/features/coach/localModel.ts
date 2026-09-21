export function useLocalCoach(_active: boolean) {
  return {
    enabled: false,
    ready: false,
    progress: 0,
    error: undefined as Error | undefined,
    generate: async (_prompt: string): Promise<string> => {
      throw new Error("Local AI is available in the native phone app.");
    },
    stop: () => {},
  };
}
