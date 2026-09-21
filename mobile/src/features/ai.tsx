import React from "react";
import { router } from "expo-router";
import { Art, Button, C, Card, Icon, Page, T } from "./ui";
export default function AI() {
  return (
    <Page
      back
      eyebrow="PRIVATE BY DESIGN"
      title={"Your food lens.\nOn your phone."}
    >
      <Art size={190} />
      <Card>
        <Icon name="phone-portrait-outline" size={32} />
        <T bold size={21}>
          Local AI lives in the native app.
        </T>
        <T color={C.muted}>
          LFM vision runs directly on supported iPhone and Android devices after
          a model download. This browser preview uses the same offline food
          library, without uploading your photos.
        </T>
      </Card>
      <Button title="Talk to Ember · voice & chat" onPress={() => router.push("/chat")} />
      <Button title="Search food library" onPress={() => router.push("/log")} />
      <Card>
        <T bold>No AI API keys</T>
        <T color={C.muted}>
          Choose the compact 450M model or the enhanced 1.6B model on your
          phone. All food suggestions need your review before logging.
        </T>
      </Card>
    </Page>
  );
}
