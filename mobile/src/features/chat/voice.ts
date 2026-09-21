export function useVoice(
  _active: boolean,
  _onTranscript: (text: string) => void,
  onFinal: (text: string) => void,
) {
  return {
    listening: false,
    speaking: false,
    error: "",
    listen: async (_lang: string) => {},
    speak: async (_text: string, _lang: string) => {},
    stop: () => {},
    finish: () => {},
    download: async (_lang: string) => {},
  };
}
