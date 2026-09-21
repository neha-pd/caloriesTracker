import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { errorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import { validateReminder } from "../reminderDomain";
import { Art, Banner, Button, C, Card, S, T, Tap, Icon } from "../ui";
type Turn = { role: "user" | "assistant"; content: string; reminder?: any };
export default function Chat() {
  const user = useAuthStore((s) => s.user),
    date = useTracker((s) => s.date),
    insets = useSafeAreaInsets();
  const [turns, setTurns] = useState<Turn[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [checking, setChecking] = useState(true),
    [diary, setDiary] = useState(false);
  const scroll = useRef<ScrollView>(null),
    run = useRef(0),
    pending = useRef(false),
    abort = useRef<AbortController | null>(null);
  function stop() {
    run.current++;
    abort.current?.abort();
    pending.current = false;
    setBusy(false);
  }
  async function status() {
    setChecking(true);
    try {
      if (user?.id === "fitlens-offline-demo") {
        setReady(false);
        return;
      }
      const { data } = await api.get("/api/v2/chat/status");
      setReady(data.available);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    stop();
    setTurns([]);
    setInput("");
    setDiary(false);
    void status();
    return () => {
      run.current++;
      abort.current?.abort();
    };
  }, [user?.id, date]);
  async function send(text = input) {
    text = text.trim();
    if (!text || !ready || pending.current) return;
    pending.current = true;
    const id = ++run.current,
      controller = new AbortController();
    abort.current = controller;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        "/api/v2/chat",
        {
          date,
          includeDiary: diary,
          messages: next
            .slice(-11)
            .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) })),
        },
        { signal: controller.signal, timeout: 60000 },
      );
      if (id !== run.current) return;
      let reminder;
      try {
        if (data.reminder) reminder = validateReminder(data.reminder);
      } catch {}
      setTurns(
        [
          ...next,
          { role: "assistant" as const, content: data.reply, reminder },
        ].slice(-40),
      );
    } catch (e) {
      if (id === run.current) {
        setError(errorMessage(e));
        setInput(text);
        setTurns(turns);
      }
    } finally {
      if (id === run.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function draft(r: any) {
    try {
      const d = validateReminder(r);
      router.push({
        pathname: "/reminder-editor",
        params: {
          title: d.title,
          body: d.body,
          hour: String(d.hour),
          minute: String(d.minute),
          cadence: d.cadence,
          interval: d.intervalHours ? String(d.intervalHours) : "",
          quiet: d.quietHours ? "true" : "false",
        },
      });
    } catch {
      setError("Please choose a reminder time manually.");
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{
        flex: 1,
        backgroundColor: "#0009",
        paddingTop: Math.max(insets.top, 24),
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: 1,
          borderColor: C.border,
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 16),
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={[S.row, { marginBottom: 12 }]}>
          <Art size={48} />
          <View style={{ flex: 1 }}>
            <T bold size={23}>
              Ember
            </T>
            <T color={C.muted} size={12}>
              Your everyday coach · online
            </T>
          </View>
          <Tap
            label="Close chat"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/dashboard")
            }
            style={S.round}
          >
            <Icon name="close" />
          </Tap>
        </View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ gap: 14, paddingBottom: 14 }}
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
        >
          {!turns.length && (
            <Card>
              <T bold size={20}>
                A little support for your day.
              </T>
              <T color={C.muted}>
                Talk through a meal, understand your diary, or plan a reminder.
              </T>
              <T size={12} color={C.muted}>
                Messages go to OpenRouter and its AI providers. Free capacity is
                shared and can run out. This conversation clears when you close
                chat.
              </T>
            </Card>
          )}
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <T bold>Use my diary & goals</T>
              <T color={C.muted} size={12}>
                {date} · saved food, water and weight targets. Sync food first
                for the latest context.
              </T>
            </View>
            <Switch
              accessibilityLabel="Share diary with coach"
              value={diary}
              disabled={busy}
              onValueChange={(v) => {
                setTurns([]);
                setDiary(v);
              }}
              trackColor={{ true: C.lime, false: C.border }}
            />
          </View>
          {!ready && (
            <Banner
              text={
                checking
                  ? "Connecting to Ember…"
                  : user?.id === "fitlens-offline-demo"
                    ? "This is an offline demo. Sign in to a real account to use online chat."
                    : "Chat is not connected right now. Food logging and manual reminders still work."
              }
            />
          )}
          {!ready && !checking && user?.id !== "fitlens-offline-demo" && (
            <Button
              secondary
              title="Retry connection"
              onPress={() => void status()}
            />
          )}
          {!turns.length &&
            ready &&
            [
              "How am I doing today?",
              "Ideas for an Indian dinner?",
              "Remind me to drink water every 2 hours",
            ].map((q) => (
              <Button
                key={q}
                secondary
                title={q}
                disabled={busy}
                onPress={() => void send(q)}
              />
            ))}
          {turns.map((t, i) => (
            <Card
              key={i}
              style={{
                backgroundColor: t.role === "user" ? C.elevated : C.card,
                marginLeft: t.role === "user" ? 24 : 0,
                marginRight: t.role === "assistant" ? 24 : 0,
              }}
            >
              <T bold color={t.role === "user" ? C.lime : C.orange}>
                {t.role === "user" ? "You" : "Ember"}
              </T>
              <T>{t.content}</T>
              {t.reminder && (
                <>
                  <T color={C.muted} size={12}>
                    Draft only · nothing scheduled yet
                  </T>
                  <Button
                    title="Review reminder"
                    onPress={() => draft(t.reminder)}
                  />
                </>
              )}
            </Card>
          ))}
          {busy && <T color={C.lime}>Ember is thinking…</T>}
          {!!error && <Banner error text={error} />}
        </ScrollView>
        <TextInput
          accessibilityLabel="Message Ember"
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          placeholder="What’s on your mind?"
          placeholderTextColor={C.muted}
          multiline
          maxLength={2000}
          style={{
            color: C.text,
            fontSize: 16,
            minHeight: 55,
            maxHeight: 130,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 16,
            padding: 14,
            marginVertical: 10,
          }}
        />
        <Button
          title={busy ? "Stop" : "Send message"}
          disabled={!busy && (!ready || !input.trim())}
          onPress={() => (busy ? stop() : void send())}
        />
        <View
          style={[S.row, { justifyContent: "space-between", paddingTop: 12 }]}
        >
          <Tap
            label="Clear conversation"
            onPress={() => {
              stop();
              setTurns([]);
              setError("");
            }}
          >
            <T color={C.muted} size={12}>
              Clear chat
            </T>
          </Tap>
          <Tap
            label="Create reminder manually"
            onPress={() => router.push("/reminder-editor")}
          >
            <T color={C.lime} size={12}>
              Create reminder
            </T>
          </Tap>
        </View>
        <T color={C.muted} size={11}>
          AI can make mistakes. Review suggestions before using them.
        </T>
      </View>
    </KeyboardAvoidingView>
  );
}
