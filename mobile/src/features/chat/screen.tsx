import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  Switch,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { router, useIsFocused } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import { useHealth } from "../health/store";
import { useLocalInference, type Turn } from "../localInference";
import { cleanModelText } from "../aiDomain";
import { useVoice } from "./voice";
import {
  boundedHistory,
  conversationContext,
  conversationSystem,
} from "./domain";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Meter,
  Page,
  S,
  Segments,
  T,
} from "../ui";
export default function Chat() {
  const focused = useIsFocused(),
    user = useAuthStore((s) => s.user),
    tracker = useTracker(),
    health = useHealth();
  const model = useLocalInference(focused, "chat");
  const [input, setInput] = useState(""),
    [turns, setTurns] = useState<Turn[]>([]),
    [partial, setPartial] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [spoken, setSpoken] = useState(true),
    [language, setLanguage] = useState("en-IN");
  const scroll = useRef<ScrollView>(null);
  const [settings, setSettings] = useState(false);
  const request = useRef(0),
    pending = useRef(false),
    finalSpeech = useRef<(text: string) => void>(() => {});
  const voice = useVoice(focused, setInput, (text) =>
    finalSpeech.current(text),
  );
  function stop() {
    if (busy)
      setTurns((p) => (p[p.length - 1]?.role === "user" ? p.slice(0, -1) : p));
    request.current++;
    model.stop();
    voice.stop();
    setBusy(false);
    setPartial("");
  }
  useEffect(() => {
    stop();
    setTurns([]);
    setInput("");
    setError("");
  }, [user?.id, tracker.date]);
  useEffect(() => {
    if (!focused) stop();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      request.current++;
      model.stop();
      voice.stop();
      listener.remove();
    };
  }, [focused]);
  async function send(text = input) {
    text = text.trim().slice(0, 500);
    if (!text || !user || !model.ready || pending.current) return;
    pending.current = true;
    voice.stop();
    const id = ++request.current,
      history = boundedHistory(turns);
    setBusy(true);
    setError("");
    setPartial("");
    setInput("");
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next.slice(-20));
    const context = conversationContext(
      {
        date: tracker.date,
        entries: tracker.entries,
        water: tracker.water,
        complete: false,
        goals: {
          calories: user.calorie_goal,
          protein: user.protein_goal_g,
          carbs: user.carbs_goal_g,
          fat: user.fat_goal_g,
          water: user.settings.water_goal_ml,
        },
      },
      user,
      {
        steps: health.steps,
        activeCalories: health.activeCalories,
        lastSync: health.lastSync,
      },
    );
    try {
      const answer = await model.generate(text, {
        system: conversationSystem(context),
        history,
        maxTokens: 320,
        onToken: (token) => {
          if (id === request.current) setPartial((p) => p + token);
        },
      });
      if (id !== request.current) return;
      setTurns(
        [...next, { role: "assistant" as const, content: answer }].slice(-20),
      );
      setPartial("");
      if (spoken) void voice.speak(answer, language);
    } catch (e) {
      if (id === request.current) {
        setError(
          e instanceof Error ? e.message : "Ember could not answer. Try again.",
        );
        setInput(text);
        setTurns(turns);
      }
    } finally {
      pending.current = false;
      if (id === request.current) {
        setBusy(false);
        setPartial("");
      }
    }
  }
  finalSpeech.current = (text) => {
    if (!pending.current) void send(text);
  };
  return (
    <Page
      scrollRef={scroll}
      onContentSizeChange={() => {
        if (busy || voice.listening)
          scroll.current?.scrollToEnd({ animated: true });
      }}
      back
      eyebrow="EMBER · ON YOUR SIDE"
      title="Let’s talk."
      subtitle="Speak or type. Your conversation and diary context stay on this device during AI inference."
    >
      <Card>
        <View style={S.row}>
          <Art size={64} />
          <View style={{ flex: 1 }}>
            <T bold size={21}>
              A conversation, just for you.
            </T>
            <T color={C.muted}>
              Ask about your day, talk through a meal, or find one small next
              step.
            </T>
          </View>
        </View>
        <T size={12} color={C.muted}>
          Using your {tracker.date} diary. Logs may be incomplete. This chat
          stays in memory and clears on logout; the model remembers the most
          recent two exchanges.
        </T>
      </Card>
      {Platform.OS === "web" ? (
        <Banner text="Voice and local AI run in the Android/iPhone app. This browser preview does not send conversations to a cloud AI." />
      ) : !model.ready || settings ? (
        <Card>
          <T bold>
            {model.ready
              ? "Conversation model downloaded · ready to talk"
              : model.enabled
                ? "Downloading conversation model…"
                : "Give Ember a voice and a mind"}
          </T>
          <T color={C.muted} size={13}>
            This is a separate language model from your food lens. Download once
            over Wi-Fi; no AI subscription or API key. Only one model runs at a
            time.
          </T>
          <Segments
            values={[
              { key: "1.2b", label: "LFM 1.2B · richer chat" },
              { key: "350m", label: "LFM 350M · lighter" },
            ]}
            value={model.model}
            onChange={(v) => {
              if (!busy)
                void model
                  .configure(false, v)
                  .catch((e) => setError(String(e)));
            }}
          />
          {model.enabled && !model.ready && <Meter value={model.progress} />}
          <T color={C.muted} size={12}>
            {model.model === "350m"
              ? "About 280 MB plus tokenizer files."
              : "About 800 MB plus tokenizer files."}{" "}
            Downloaded files are reused.
          </T>
          {model.error && <Banner error text={model.error.message} />}
          <Button
            secondary={model.enabled}
            disabled={busy}
            title={
              model.enabled
                ? "Disable conversation model"
                : "Download & enable conversation model"
            }
            onPress={() =>
              void model
                .configure(!model.enabled)
                .catch((e) => setError(String(e)))
            }
          />
          <Button
            secondary
            title="Manage food-photo model"
            onPress={() =>
              router.push({ pathname: "/ai", params: { mode: "settings" } })
            }
          />
        </Card>
      ) : (
        <Card>
          <T bold color={C.lime}>
            Ember is ready · on-device
          </T>
          <T color={C.muted} size={12}>
            Conversation model: {model.model}. Microphone permission is
            requested when you tap Talk.
          </T>
        </Card>
      )}
      <Button
        secondary
        title={settings ? "Hide AI & voice settings" : "AI & voice settings"}
        onPress={() => setSettings(!settings)}
      />
      {(settings || !model.ready) && (
        <Card>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <T bold>Speak Ember’s replies</T>
              <T color={C.muted} size={12}>
                Uses an installed device voice. You can stop playback anytime.
              </T>
            </View>
            <Switch
              accessibilityLabel="Speak Ember's replies"
              value={spoken}
              onValueChange={(v) => {
                setSpoken(v);
                if (!v) voice.stop();
              }}
              trackColor={{ true: C.lime, false: C.border }}
            />
          </View>
          <Segments
            values={[
              { key: "en-IN", label: "English · India" },
              { key: "en-US", label: "English · US" },
            ]}
            value={language}
            onChange={(v) => {
              voice.stop();
              setLanguage(v);
            }}
          />
          {Platform.OS !== "web" && (
            <Button
              secondary
              title="Set up offline dictation"
              onPress={() => void voice.download(language)}
            />
          )}
        </Card>
      )}
      {!turns.length && (
        <View style={{ gap: 10 }}>
          {[
            "How am I doing today?",
            "What could I make for dinner?",
            "Help me build a water habit.",
          ].map((text) => (
            <Button
              key={text}
              secondary
              title={text}
              disabled={!model.ready || busy}
              onPress={() => void send(text)}
            />
          ))}
        </View>
      )}
      {turns.map((turn, i) => (
        <Card
          key={i}
          style={{
            backgroundColor: turn.role === "user" ? C.elevated : C.card,
          }}
        >
          <T bold color={turn.role === "user" ? C.lime : C.orange}>
            {turn.role === "user" ? "You" : "Ember"}
          </T>
          <T>{turn.content}</T>
          {turn.role === "assistant" && Platform.OS !== "web" && (
            <Button
              secondary
              title="Read aloud"
              disabled={busy || voice.listening}
              onPress={() => void voice.speak(turn.content, language)}
            />
          )}
        </Card>
      ))}
      {busy && (
        <Card>
          <T bold color={C.orange}>
            Ember is thinking…
          </T>
          <T>
            {cleanModelText(partial) ||
              "Loading your local model and reading the latest diary."}
          </T>
        </Card>
      )}
      {error && <Banner error text={error} />}
      {voice.error && (
        <>
          <Banner text={voice.error} />
          <Button
            secondary
            title="Open device settings"
            onPress={() => void Linking.openSettings()}
          />
        </>
      )}
      <Card>
        <TextInput
          accessibilityLabel="Message Ember"
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          placeholder="What’s on your mind?"
          placeholderTextColor={C.muted}
          multiline
          maxLength={500}
          style={{
            color: C.text,
            fontSize: 16,
            minHeight: 80,
            padding: 12,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 16,
          }}
        />
        <Button
          title={busy ? "Ember is thinking…" : "Send message"}
          disabled={!model.ready || !input.trim() || busy || voice.listening}
          onPress={() => void send()}
        />
        {Platform.OS !== "web" && (
          <Button
            secondary
            icon="mic-outline"
            title={voice.listening ? "Finish speaking" : "Talk to Ember"}
            disabled={!model.ready || busy}
            onPress={() =>
              voice.listening ? voice.finish() : void voice.listen(language)
            }
          />
        )}
        <T color={C.muted} size={12}>
          Tap Talk, speak, then pause. Your final words are sent to the local
          model automatically. No audio recording is saved.
        </T>
        {(busy || voice.listening || voice.speaking) && (
          <Button secondary title="Stop" onPress={stop} />
        )}
      </Card>
      {turns.length > 0 && (
        <Button
          secondary
          title="Clear conversation"
          onPress={() => {
            stop();
            setTurns([]);
            setInput("");
            setError("");
          }}
        />
      )}
      <Button
        secondary
        title="Turn an idea into a reminder"
        onPress={() => router.push("/reminder-editor")}
      />
      <T color={C.muted} size={12}>
        AI can be mistaken. Review suggestions. Ember does not automatically
        change your diary, targets or reminders.
      </T>
    </Page>
  );
}
