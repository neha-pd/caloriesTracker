import React from "react";
import { Platform, View } from "react-native";
import { Banner, Button, C, Card, Icon, Page, S, T } from "../ui";
import { useHealth } from "./store";
import * as adapter from "./adapter";
export default function Health() {
  const s = useHealth();
  const platform = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  return (
    <Page
      back
      eyebrow="A MORE CONNECTED ROUTINE"
      title={"Your habits.\nIn good sync."}
      subtitle="Bring your food diary and daily movement together."
    >
      <Card style={{ backgroundColor: "#252b30", borderColor: "#415769" }}>
        <Icon name="heart-outline" color={C.blue} size={40} />
        <T bold size={24}>
          {Platform.OS === "web" ? "Apple Health + Health Connect" : platform}
        </T>
        <T color={C.muted}>
          {Platform.OS === "ios"
            ? "Apple Watch activity reaches FitLens through Apple Health on your iPhone."
            : "Compatible watch and phone apps can share activity through Android Health Connect."}
        </T>
      </Card>
      <Card>
        <T bold>Read daily activity</T>
        <T color={C.muted}>
          Steps and active energy, where you grant access. Activity stays on
          this device and does not change your food targets.
        </T>
        <T bold style={{ marginTop: 12 }}>
          Write your confirmed logs
        </T>
        <T color={C.muted}>
          Meals, macros, and water created after you connect. Updates and
          removals sync for FitLens records. Existing history is not exported
          automatically.
        </T>
      </Card>
      {s.enabled && (
        <>
          <View style={S.two}>
            <Card style={{ flex: 1 }}>
              <T bold size={27}>
                {s.steps == null ? "—" : Math.round(s.steps).toLocaleString()}
              </T>
              <T color={C.muted}>Steps today</T>
            </Card>
            <Card style={{ flex: 1 }}>
              <T bold size={27}>
                {s.activeCalories == null ? "—" : Math.round(s.activeCalories)}
              </T>
              <T color={C.muted}>Active kcal</T>
            </Card>
          </View>
          <T size={12} color={C.muted}>
            {s.lastSync
              ? `Last sync ${new Date(s.lastSync).toLocaleString()}`
              : "Waiting for your first sync."}{" "}
            No data can mean no records or missing read permission.
          </T>
        </>
      )}
      {s.error && <Banner error text={s.error} />}
      {Platform.OS === "web" ? (
        <Banner text="Connect from the native iPhone or Android app. Health services are not available in this browser preview." />
      ) : s.enabled ? (
        <>
          <Button
            title="Sync health now"
            loading={s.busy}
            onPress={() => void s.sync()}
          />
          <Button
            secondary
            title="Review health permissions"
            onPress={() =>
              void adapter
                .authorize()
                .catch((e) => useHealth.setState({ error: String(e) }))
            }
          />
          <Button
            secondary
            title="Disconnect health sync"
            onPress={() => void s.disconnect()}
          />
        </>
      ) : (
        <Button
          title={`Connect ${platform}`}
          loading={s.busy}
          onPress={() => void s.connect()}
        />
      )}
      <T size={12} color={C.muted}>
        Sync runs while FitLens is open or when you return to the app. You
        control permissions in your health app. Disconnecting stops FitLens
        sync; it does not delete records already exported or revoke system
        permissions.
      </T>
    </Page>
  );
}
