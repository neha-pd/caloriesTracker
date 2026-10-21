import React from "react";
import { router } from "expo-router";
import { Page, Card, T, C, Button, RowLink } from "./ui";
export async function clearReminders() {}
export default function Reminders() {
  return (
    <Page
      back
      eyebrow="YOUR ROUTINE"
      title="A little nudge, in your calendar."
      subtitle="Choose a time, export the event and set an alert in Calendar."
    >
      <Card>
        <T bold>Reminders on iPhone</T>
        <T color={C.muted}>
          This PWA does not send alerts while it is closed. Calendar can remind
          you after you import an event and enable its alerts.
        </T>
      </Card>
      <Card>
        {[
          ["Breakfast", 8],
          ["Lunch", 13],
          ["Dinner", 20],
          ["Drink water", 10],
        ].map(([title, hour]) => (
          <RowLink
            key={title}
            title={String(title)}
            value={`${String(hour).padStart(2, "0")}:00`}
            icon="calendar-outline"
            onPress={() =>
              router.push({
                pathname: "/reminder-editor",
                params: {
                  title: String(title),
                  body: `A little check-in: ${String(title).toLowerCase()}.`,
                  hour: String(hour),
                  minute: "0",
                },
              })
            }
          />
        ))}
      </Card>
      <Button
        title="Create a calendar reminder"
        onPress={() => router.push("/reminder-editor")}
      />
      <Button
        secondary
        title="Open my workout plan"
        onPress={() => router.push("/train")}
      />
      <T size={12} color={C.muted}>
        In Train, open Settings to export your workout schedule. Manage imported
        reminders in Calendar; logging out of Fitkin will not remove calendar
        events. Re-importing can create duplicates.
      </T>
    </Page>
  );
}
