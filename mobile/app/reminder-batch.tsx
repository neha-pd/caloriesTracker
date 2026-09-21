import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Page, Card, T, Field, Button, Banner, C } from "../src/features/ui";
import {
  validateReminder,
  reminderSummary,
  ReminderDraft,
} from "../src/features/reminderDomain";
import { saveReminderBatch } from "../src/features/customReminders";
import { useAuthStore } from "../src/store/authStore";
export default function Batch() {
  const p = useLocalSearchParams<{ drafts: string; batchId: string }>(),
    uid = useAuthStore((s) => s.user?.id);
  const [drafts, setDrafts] = useState(() => {
      try {
        return (JSON.parse(p.drafts) as ReminderDraft[])
          .slice(0, 8)
          .map(validateReminder);
      } catch {
        return [];
      }
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <Page
      back
      title="Your reminder plan."
      subtitle="Suggested times, in your device’s local timezone. Nothing is scheduled until you confirm."
    >
      {drafts.map((d, i) => (
        <Card key={i}>
          <Field
            label={"Title " + (i + 1)}
            value={d.title}
            onChange={(v) =>
              setDrafts((a) =>
                a.map((x, j) => (i === j ? { ...x, title: v } : x)),
              )
            }
          />
          <T>{d.body}</T>
          <Field
            label={"Hour " + (i + 1)}
            value={String(d.hour)}
            numeric
            onChange={(v) =>
              setDrafts((a) =>
                a.map((x, j) =>
                  i === j ? { ...x, hour: v === "" ? NaN : Number(v) } : x,
                ),
              )
            }
          />
          <Field
            label={"Minute " + (i + 1)}
            value={String(d.minute)}
            numeric
            onChange={(v) =>
              setDrafts((a) =>
                a.map((x, j) =>
                  i === j ? { ...x, minute: v === "" ? NaN : Number(v) } : x,
                ),
              )
            }
          />
          <T size={12} color={C.muted}>
            {d.cadence} ·{" "}
            {d.quietHours ? "quiet hours 22:00–08:00" : "overnight allowed"}
          </T>
        </Card>
      ))}
      {!!error && <Banner error text={error} />}{" "}
      {done ? (
        <>
          <Banner text="Your reminders are scheduled on this device." />
          <Button
            title="View reminders"
            onPress={() => router.replace("/reminders")}
          />
        </>
      ) : (
        <Button
          title="Confirm & schedule all"
          disabled={!uid || !drafts.length}
          loading={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            void saveReminderBatch(
              uid!,
              drafts.map((draft, i) => ({ id: p.batchId + ":" + i, draft })),
            )
              .then(() => setDone(true))
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </Page>
  );
}
