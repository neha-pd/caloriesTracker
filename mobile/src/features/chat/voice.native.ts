import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule as SR,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
const androidVoice =
  Platform.OS === "android"
    ? requireOptionalNativeModule("FitLensVoice")
    : null;
export function useVoice(
  active: boolean,
  onTranscript: (text: string) => void,
  onFinal: (text: string) => void,
) {
  const [listening, setListening] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState("");
  const live = useRef(active),
    generation = useRef(0);
  live.current = active;
  useSpeechRecognitionEvent("start", () => {
    if (live.current) setListening(true);
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (e) => {
    if (live.current && e.results[0]) {
      onTranscript(e.results[0].transcript);
      if (e.isFinal) onFinal(e.results[0].transcript);
    }
  });
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (live.current && e.error !== "aborted")
      setError(
        e.error === "no-speech"
          ? "No speech heard. Tap the microphone and try again."
          : `Voice input: ${e.message || e.error}. Install offline English speech data in device settings, or type your message.`,
      );
  });
  function stop() {
    generation.current++;
    SR.abort();
    androidVoice?.stop();
    void Speech.stop();
    setListening(false);
    setSpeaking(false);
  }
  useEffect(() => {
    live.current = active;
    const sub = androidVoice?.addListener(
      "speechState",
      (e: { speaking: boolean; error?: string }) => {
        if (live.current) {
          setSpeaking(e.speaking);
          if (e.error) setError(e.error);
        }
      },
    );
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    if (!active) stop();
    return () => {
      live.current = false;
      stop();
      sub?.remove();
      app.remove();
    };
  }, [active]);
  async function listen(language: string) {
    stop();
    setError("");
    const request = generation.current;
    try {
      if (!SR.supportsOnDeviceRecognition())
        throw new Error(
          "This phone does not offer on-device dictation. Type your message; no cloud recognition will be used.",
        );
      const p = await SR.requestPermissionsAsync();
      if (!p.granted)
        throw new Error(
          "Microphone or speech permission is off. Enable it in device settings, then try again.",
        );
      if (!live.current || request !== generation.current) return;
      SR.start({
        lang: language,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: true,
        recordingOptions: { persist: false },
      });
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : "Voice input could not start.",
        );
    }
  }
  async function speak(text: string, language: string) {
    stop();
    setError("");
    const request = generation.current;
    try {
      if (Platform.OS === "android") {
        if (!androidVoice)
          throw new Error(
            "Install the updated FitLens APK to enable spoken replies.",
          );
        await androidVoice.prepare();
        if (!live.current || request !== generation.current) return;
        await androidVoice.speak(text, language);
      } else {
        const voices = await Speech.getAvailableVoicesAsync();
        const voice =
          voices.find((v) => v.language === language) ||
          voices.find((v) => v.language.startsWith(language.slice(0, 2)));
        if (!voice)
          throw new Error(
            "Download an English voice in iPhone accessibility settings.",
          );
        if (!live.current || request !== generation.current) return;
        Speech.speak(text.slice(0, 3500), {
          voice: voice.identifier,
          language,
          onStart: () => setSpeaking(true),
          onDone: () => setSpeaking(false),
          onStopped: () => setSpeaking(false),
          onError: () => {
            setSpeaking(false);
            setError("Could not play the voice. Check device voice settings.");
          },
        });
      }
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : "Could not speak this answer.",
        );
    }
  }
  async function download(language: string) {
    try {
      setError("");
      if (Platform.OS !== "android" || Number(Platform.Version) < 33)
        throw new Error(
          "Install offline English speech data in device settings.",
        );
      const result = await SR.androidTriggerOfflineModelDownload({
        locale: language,
      });
      setError(
        result.status === "download_success"
          ? "Offline dictation downloaded. Try the microphone."
          : "Speech download requested. Finish the device prompt, then try the microphone.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Open device speech settings to install offline dictation.",
      );
    }
  }
  return {
    listening,
    speaking,
    error,
    listen,
    speak,
    stop,
    finish: () => SR.stop(),
    download,
  };
}
