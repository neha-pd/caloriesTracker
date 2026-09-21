import React, { useEffect, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "expo-router";
import {
  Banner,
  Button,
  C,
  Card,
  Field,
  Meter,
  Page,
  S,
  Segments,
  T,
} from "./ui";
import { useAuthStore } from "../store/authStore";
import { useLocalCoach } from "./coach/localModel";
import {
  parseReminder,
  reminderPrompt,
  validateReminder,
  type Cadence,
  type CustomReminder,
} from "./reminderDomain";
import { listCustomReminders, saveCustomReminder } from "./customReminders";
export default function ReminderEditor() {
  const params = useLocalSearchParams<{
      id?: string;
      title?: string;
      body?: string;
      hour?: string;
    }>(),
    uid = useAuthStore((s) => s.user?.id),
    focused = useIsFocused(),
    model = useLocalCoach(focused);
  const [title, setTitle] = useState(params.title || "My little check-in"),
    [body, setBody] = useState(params.body || "Take a moment for yourself."),
    [hour, setHour] = useState(params.hour || "15"),
    [minute, setMinute] = useState("00"),
    [cadence, setCadence] = useState<Cadence>("daily"),
    [quiet, setQuiet] = useState(true),
    [request, setRequest] = useState(""),
    [existing, setExisting] = useState<CustomReminder>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (uid && params.id)
      void listCustomReminders(uid).then((all) => {
        const r = all.find((r) => r.id === params.id);
        if (r) {
          setExisting(r);
          setTitle(r.title);
          setBody(r.body);
          setHour(String(r.hour));
          setMinute(String(r.minute).padStart(2, "0"));
          setCadence(r.cadence);
          setQuiet(r.quietHours);
        }
      });
  }, [uid, params.id]);
  async function draft() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!request.trim())
        throw new Error(
          "Describe a reminder and include a time, for example “water at 3 pm on weekdays”.",
        );
      const d = parseReminder(
        await model.generate(reminderPrompt(request)),
        request,
      );
      setTitle(d.title);
      setBody(d.body);
      setHour(String(d.hour));
      setMinute(String(d.minute).padStart(2, "0"));
      setCadence(d.cadence);
      setQuiet(d.quietHours);
      setMessage(
        "Draft ready. Check the wording, time, and repeat schedule before saving.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft a reminder.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!uid) throw new Error("Sign in to save your reminder.");
      const d = validateReminder({
        title,
        body,
        hour: Number(hour),
        minute: Number(minute),
        cadence,
        quietHours: quiet,
      });
      await saveCustomReminder(uid, d, existing);
      router.replace("/reminders");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your reminder.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="YOUR ROUTINE, YOUR WORDS"
      title={existing ? "Tune your reminder." : "A nudge that fits you."}
    >
      <Card>
        <T bold>Describe it to your local coach</T>
        <Field
          label="What should I remind you about?"
          value={request}
          onChange={setRequest}
          placeholder="Water at 3 pm on weekdays"
        />
        {model.ready ? (
          <Button
            secondary
            title="Draft with local AI"
            loading={busy}
            onPress={() => void draft()}
          />
        ) : (
          <>
            <T color={C.muted} size={13}>
              {Platform.OS === "web"
                ? "AI drafting is available in the native app. The fields below work as a preview."
                : model.enabled
                  ? "Preparing local model…"
                  : "Enable your local model to turn a sentence into a draft, or edit the fields below."}
            </T>
            {model.enabled && <Meter value={model.progress} />}
            <Button
              secondary
              title="Manage local AI"
              onPress={() => router.push({ pathname: "/chat" })}
            />
          </>
        )}
        {model.error && <Banner error text={model.error.message} />}
      </Card>
      <Card>
        <T bold size={19}>
          Review before scheduling
        </T>
        <Field
          label="Notification title"
          value={title}
          onChange={setTitle}
          testID="reminder-title"
        />
        <Field
          label="Notification message"
          value={body}
          onChange={setBody}
          testID="reminder-body"
        />
        <View style={S.two}>
          <Field
            label="Hour · 00–23"
            value={hour}
            onChange={setHour}
            numeric
            testID="reminder-hour"
          />
          <Field
            label="Minute · 00–59"
            value={minute}
            onChange={setMinute}
            numeric
            testID="reminder-minute"
          />
        </View>
        <Segments
          values={[
            { key: "daily", label: "Daily" },
            { key: "weekdays", label: "Weekdays" },
            { key: "weekends", label: "Weekends" },
          ]}
          value={cadence}
          onChange={(v) => setCadence(v as Cadence)}
        />
        <View style={S.row}>
          <View style={{ flex: 1 }}>
            <T bold size={13}>
              Respect quiet hours
            </T>
            <T color={C.muted} size={12}>
              No reminders between 22:00 and 08:00.
            </T>
          </View>
          <Switch
            accessibilityLabel="Respect quiet hours"
            value={quiet}
            onValueChange={setQuiet}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </View>
        <T color={C.lime}>
          Preview: {hour.padStart(2, "0")}:{minute.padStart(2, "0")} · {cadence}{" "}
          · device local time
        </T>
        <T color={C.muted} size={12}>
          Notification text may appear on your lock screen. Keep personal
          details out if you prefer.
        </T>
      </Card>
      {error && <Banner error text={error} />}
      {message && <Banner text={message} />}
      <Button
        title="Confirm & schedule reminder"
        testID="reminder-save"
        loading={busy}
        onPress={() => void save()}
      />
      <T color={C.muted} size={12}>
        LFM drafts while the app is open. Once saved, your phone schedules the
        reminder without running AI in the background. Delivery timing can vary
        with device settings. Reminders stop on logout.
      </T>
    </Page>
  );
}
