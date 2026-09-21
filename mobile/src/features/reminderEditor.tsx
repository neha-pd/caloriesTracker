import { DateTimeField } from "./pickers";
import React, { useEffect, useState, useRef } from "react";
import { Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "expo-router";
import { Banner, Button, C, Card, Field, Page, S, Segments, T } from "./ui";
import { useAuthStore } from "../store/authStore";
import {
  localReminderDraft,
  reminderTimes,
  reminderSummary,
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
      minute?: string;
      cadence?: string;
      interval?: string;
      quiet?: string;
    }>(),
    uid = useAuthStore((s) => s.user?.id),
    focused = useIsFocused();
  const [title, setTitle] = useState(params.title || "My little check-in"),
    [body, setBody] = useState(params.body || "Take a moment for yourself."),
    [hour, setHour] = useState(params.hour || "15"),
    [minute, setMinute] = useState(params.minute || "00"),
    [cadence, setCadence] = useState<Cadence>(
      ["daily", "weekdays", "weekends"].includes(params.cadence || "")
        ? (params.cadence as Cadence)
        : "daily",
    ),
    [quiet, setQuiet] = useState(params.quiet !== "false"),
    [interval, setInterval] = useState(params.interval || ""),
    [needsDraft, setNeedsDraft] = useState(false),
    [request, setRequest] = useState(""),
    [existing, setExisting] = useState<CustomReminder>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const requestVersion = useRef(0);
  useEffect(
    () => () => {
      requestVersion.current++;
    },
    [focused, uid],
  );
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
          setInterval(r.intervalHours ? String(r.intervalHours) : "");
        }
      });
  }, [uid, params.id]);
  async function draft() {
    const version = requestVersion.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!request.trim())
        throw new Error(
          "Describe a reminder, for example “water every 2 hours” or “water at 3 pm on weekdays”.",
        );
      let d = localReminderDraft(request);
      let wording = "Schedule prepared.";
      if (version !== requestVersion.current) return;
      setTitle(d.title);
      setBody(d.body);
      setHour(String(d.hour));
      setMinute(String(d.minute).padStart(2, "0"));
      setCadence(d.cadence);
      setQuiet(d.quietHours);
      setInterval(d.intervalHours ? String(d.intervalHours) : "");
      setNeedsDraft(false);
      setMessage(
        `${wording} ${d.intervalHours ? "Proposed interval: every " + d.intervalHours + " hours, repeating on the selected days. Quiet hours are on; turn them off only if you want overnight reminders." : "Check the time and repeat schedule."} Nothing is scheduled until you confirm.`,
      );
    } catch (e) {
      if (version !== requestVersion.current) return;
      setNeedsDraft(true);
      setError(e instanceof Error ? e.message : "Could not draft a reminder.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (needsDraft)
        throw new Error(
          "Prepare the changed request first, or choose manual editing.",
        );
      if (!uid) throw new Error("Sign in to save your reminder.");
      const d = validateReminder({
        title,
        body,
        hour: Number(hour),
        minute: Number(minute),
        cadence,
        quietHours: quiet,
        intervalHours: interval ? Number(interval) : undefined,
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
        <T bold>Describe your reminder</T>
        <Field
          label="What should I remind you about?"
          value={request}
          onChange={(v) => {
            requestVersion.current++;
            setRequest(v);
            setNeedsDraft(!!v.trim());
            setMessage("");
            setError("");
          }}
          testID="reminder-request"
          placeholder="Drink water every 2 hours"
        />
        <Button
          secondary
          title="Prepare reminder"
          testID="reminder-draft"
          loading={busy}
          onPress={() => void draft()}
        />
        <T color={C.muted} size={13}>
          Describe a time or interval, then review your schedule.
        </T>
        {needsDraft && (
          <Button
            secondary
            title="Use manual fields instead"
            onPress={() => {
              requestVersion.current++;
              setRequest("");
              setNeedsDraft(false);
              setError("");
              setMessage("");
            }}
          />
        )}
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
        <Segments
          values={[
            { key: "once", label: "One time per day" },
            { key: "interval", label: "Regular intervals" },
          ]}
          value={interval ? "interval" : "once"}
          onChange={(v) => setInterval(v === "interval" ? "2" : "")}
        />
        {interval ? (
          <Field
            label="Repeat every · hours (1–12)"
            value={interval}
            onChange={(v) => setInterval(v || "0")}
            numeric
            testID="reminder-interval"
          />
        ) : (
          <DateTimeField
            label="Reminder time"
            mode="time"
            value={hour.padStart(2, "0") + ":" + minute.padStart(2, "0")}
            onChange={(v) => {
              const [h, m] = v.split(":");
              setHour(h);
              setMinute(m);
            }}
            testID="reminder-time"
          />
        )}
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
          Preview:{" "}
          {reminderSummary({
            hour: Number(hour),
            minute: Number(minute),
            quietHours: quiet,
            intervalHours: interval ? Number(interval) : undefined,
          })}{" "}
          · {cadence} · device local time
        </T>
        {interval && (
          <T color={C.lime} testID="reminder-times">
            {reminderTimes({
              hour: 0,
              minute: 0,
              quietHours: quiet,
              intervalHours: Number(interval),
            })
              .map((t) => String(t.hour).padStart(2, "0") + ":00")
              .join(" · ") || "Choose an interval from 1 to 12 hours."}
          </T>
        )}
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
        disabled={needsDraft || busy}
        loading={busy}
        onPress={() => void save()}
      />
      <T color={C.muted} size={12}>
        Once saved, your phone schedules the reminder in the background.
        Delivery timing can vary with device settings. Reminders stop on logout.
      </T>
    </Page>
  );
}
