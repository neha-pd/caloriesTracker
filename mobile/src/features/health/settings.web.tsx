import React from "react";
import { router } from "expo-router";
import { Page, Card, T, C, Button } from "../ui";
export default function WatchSettings() {
  return (
    <Page
      back
      title="Movement on iPhone"
      subtitle="Keep food and fitness together, with manual activity logging."
    >
      <Card>
        <T bold>Apple Health needs a native app</T>
        <T color={C.muted}>
          Safari and this Home Screen app cannot read Apple Watch or Apple
          Health data. Fitkin’s Android app supports Health Connect; an iPhone
          native app is not available in this release.
        </T>
      </Card>
      <Button title="Log a workout" onPress={() => router.push("/activity")} />
      <T color={C.muted}>
        You can enter your workout time and active calories from your watch.
        Missing readings will stay blank.
      </T>
    </Page>
  );
}
