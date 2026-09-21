import React from "react";
import { router } from "expo-router";
import { Page, Button } from "../src/features/ui";
export default function Add() {
  return (
    <Page back title="What did you do today?">
      <Button title="Add food" onPress={() => router.replace("/log")} />
      <Button
        title="Log activity"
        onPress={() => router.replace("/activity")}
      />
      <Button
        title="Log weight"
        onPress={() =>
          router.replace({ pathname: "/activity", params: { kind: "weight" } })
        }
      />
      <Button title="Add water" onPress={() => router.replace("/water")} />
    </Page>
  );
}
