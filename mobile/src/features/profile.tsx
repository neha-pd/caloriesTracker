import { useNudges } from "./nudges/store";
import { pauseNudgesSession } from "./nudges/native";
import { useHealth, removeLocalHealth } from "./health/store";
import React, { useState } from "react";
import { View, Platform, Switch, Share } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Field,
  Icon,
  Page,
  RowLink,
  S,
  T,
} from "./ui";
import { useAuthStore } from "../store/authStore";
import { useTracker } from "./tracker";
import api, { errorMessage } from "../lib/api";
import { clearSession } from "../lib/session";
export function Profile() {
  const u = useAuthStore((s) => s.user),
    s = useTracker(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  async function logout() {
    setBusy(true);
    await useAuthStore.getState().logout();
    setBusy(false);
  }
  return (
    <Page eyebrow="YOUR OWN KIND OF PROGRESS" title="A little more you.">
      <Card>
        <View style={S.row}>
          <View
            style={[
              S.round,
              {
                width: 65,
                height: 65,
                borderRadius: 24,
                backgroundColor: C.lime,
              },
            ]}
          >
            <T bold color={C.bg} size={28}>
              {u?.display_name?.slice(0, 1).toUpperCase()}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T bold size={24}>
              {u?.display_name}
            </T>
            <T color={C.muted} size={13}>
              {u?.email}
            </T>
            <T color={C.lime} size={12}>
              LEVEL {s.progress.level} · {s.progress.xp} XP
            </T>
          </View>
        </View>
      </Card>
      <Card>
        <RowLink
          title="My profile"
          icon="person-outline"
          onPress={() => router.push("/edit-profile")}
        />
        <RowLink
          title="Daily targets"
          icon="flag-outline"
          value={`${u?.calorie_goal} kcal`}
          onPress={() => router.push("/edit-goals")}
        />
        <RowLink
          title="Health & watch sync"
          icon="heart-outline"
          onPress={() => router.push("/watch-settings")}
        />
        <RowLink
          title="Home-screen widgets"
          icon="grid-outline"
          onPress={() => router.push("/widgets")}
        />
        <RowLink
          title="Chat with Ember"
          icon="chatbubble-outline"
          onPress={() => router.push("/chat")}
        />
        <RowLink
          title="How to use FitLens"
          icon="help-circle-outline"
          onPress={() => router.push("/guide")}
        />
        <RowLink
          title="Preferences & reminders"
          icon="options-outline"
          onPress={() => router.push("/preferences")}
        />
        <RowLink
          title="Privacy & my data"
          icon="shield-checkmark-outline"
          onPress={() => router.push("/privacy")}
        />
      </Card>
      <Card>
        <T bold>
          {u?.id === "fitlens-offline-demo"
            ? "Offline demo"
            : "Across your devices"}
        </T>
        <T color={C.muted} size={13}>
          {s.queue.length
            ? `${s.queue.length} changes waiting to sync.`
            : s.syncing
              ? "Syncing your little wins…"
              : u?.id === "fitlens-offline-demo"
                ? "Sample data and your edits stay on this device. Exit the demo to sign in to your own account."
                : u?.id === "fitlens-offline-demo"
                  ? "Fictional sample data stays on this device."
                  : "Your confirmed logs sync to your account."}
        </T>
        {s.error && <Banner text={s.error} error />}
        <Button
          secondary
          title="Sync now"
          loading={s.syncing}
          onPress={() => void s.sync()}
        />
      </Card>
      {confirm ? (
        <Card>
          <T bold>Log out of this device?</T>
          <T color={C.muted}>
            {s.queue.length
              ? "You have unsynced changes. They remain on this device for your next login. Sync first to see them elsewhere."
              : u?.id === "fitlens-offline-demo"
                ? "Your demo changes stay on this device for your next visit."
                : "Your synced progress will be here when you return."}
          </T>
          <Button
            danger
            title="Yes, log out"
            testID="logout-confirm"
            loading={busy}
            onPress={() => void logout()}
          />
          <Button
            secondary
            title="Stay here"
            onPress={() => setConfirm(false)}
          />
        </Card>
      ) : (
        <Button
          secondary
          title="Log out"
          testID="logout"
          onPress={() => setConfirm(true)}
        />
      )}
      <T color={C.muted} size={12} style={{ textAlign: "center" }}>
        FitLens · Made for your everyday spark
      </T>
    </Page>
  );
}
export function EditProfile() {
  const u = useAuthStore((s) => s.user),
    [name, setName] = useState(u?.display_name || ""),
    [age, setAge] = useState(u?.age ? String(u.age) : ""),
    [height, setHeight] = useState(u?.height_cm ? String(u.height_cm) : ""),
    [weight, setWeight] = useState(u?.weight_kg ? String(u.weight_kg) : ""),
    [targetWeight, setTargetWeight] = useState(
      u?.weight_goal_kg ? String(u.weight_goal_kg) : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (targetWeight && !Number.isFinite(Number(targetWeight)))
        throw new Error("Enter a valid target weight.");
      const { data } = await api.patch("/api/users/me", {
        display_name: name.trim(),
        ...(age ? { age: Number(age) } : {}),
        ...(height ? { height_cm: Number(height) } : {}),
        ...(weight ? { weight_kg: Number(weight) } : {}),
        weight_goal_kg: targetWeight ? Number(targetWeight) : null,
      });
      useAuthStore.getState().updateUser(data.user);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      title="Hello, you."
      subtitle="Make this space feel like your own."
    >
      <Field
        label="Your name"
        value={name}
        onChange={setName}
        testID="profile-name"
      />
      <Card>
        <T bold>Optional details</T>
        <T size={13} color={C.muted}>
          These details are private to your account.
        </T>
        <Field
          label="Age · years (18+)"
          value={age}
          onChange={setAge}
          numeric
        />
        <View style={S.two}>
          <Field
            label="Height · cm"
            value={height}
            onChange={setHeight}
            numeric
          />
          <Field
            testID="profile-weight"
            label="Weight · kg"
            value={weight}
            onChange={setWeight}
            numeric
          />
        </View>
      </Card>
      <Field
        label="Target weight · kg (optional)"
        value={targetWeight}
        onChange={setTargetWeight}
        numeric
        testID="profile-target-weight"
      />
      {error && <Banner text={error} error />}
      <Button
        title="Save profile"
        testID="profile-save"
        loading={busy}
        onPress={() => void save()}
      />
    </Page>
  );
}
export function Preferences() {
  const u = useAuthStore((s) => s.user),
    [water, setWater] = useState(String(u?.settings.water_goal_ml || 2000)),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function update(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.patch("/api/users/me/settings", values);
      useAuthStore.getState().updateUser(data.user);
      setMessage("Preferences saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page back eyebrow="SET YOUR OWN PACE" title="The little details.">
      <Card>
        <T bold size={18}>
          Your water target
        </T>
        <Field
          label="Daily water · ml"
          value={water}
          onChange={setWater}
          numeric
        />
        <Button
          title="Save water target"
          loading={busy}
          onPress={() => void update({ water_goal_ml: Number(water) })}
        />
      </Card>
      <Card>
        <View style={S.row}>
          <View style={{ flex: 1 }}>
            <T bold>Haptic feedback</T>
            <T color={C.muted} size={13}>
              A gentle tap for little actions.
            </T>
          </View>
          <Switch
            accessibilityLabel="Haptic feedback"
            value={u?.settings.haptics ?? true}
            onValueChange={(v) => void update({ haptics: v })}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </View>
      </Card>
      <RowLink
        title="Gentle reminders"
        subtitle="Choose local notifications on this device"
        icon="notifications-outline"
        onPress={() => router.push("/reminders")}
      />
      {error && <Banner error text={error} />}
      {message && <Banner text={message} />}
    </Page>
  );
}
export function Privacy() {
  const u = useAuthStore((s) => s.user),
    [password, setPassword] = useState(""),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function exportData() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/api/users/me/export");
      if (useAuthStore.getState().user?.id !== u?.id)
        throw new Error("Your account changed; export again.");
      const health = useHealth.getState();
      const text = JSON.stringify(
        {
          ...data,
          device_health: health.uid === u?.id ? health.days : {},
          smart_nudges:
            useNudges.getState().uid === u?.id
              ? useNudges.getState().settings
              : null,
        },
        null,
        2,
      );
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "fitlens-data.json";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fs = await import("expo-file-system");
        const sharing = await import("expo-sharing");
        const file = new fs.File(fs.Paths.cache, "fitlens-data.json");
        file.write(text);
        await sharing.shareAsync(file.uri, { mimeType: "application/json" });
      }
      setMessage("Your export is ready.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.delete("/api/users/me", { data: { password } });
      pauseNudgesSession();
      if (u?.id) await removeLocalHealth(u.id);
      await AsyncStorage.removeItem("fitlens:data:" + u?.id);
      const privateKeys = (await AsyncStorage.getAllKeys()).filter(
        (k) =>
          k === `fitlens:custom-reminders:${u?.id}` ||
          k === `fitlens:nudges:${u?.id}` ||
          k.startsWith(`fitlens:coach:${u?.id}:`),
      );
      if (privateKeys.length) await AsyncStorage.multiRemove(privateKeys);
      await AsyncStorage.removeItem("fitlens:profile");
      await clearSession();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page back eyebrow="YOUR DATA, YOUR CHOICE" title="A private little space.">
      <Card>
        <Icon name="shield-checkmark-outline" size={32} />
        <T bold size={20}>
          Your health, your choice.
        </T>
        <T color={C.muted}>
          {u?.id === "fitlens-offline-demo"
            ? "This demo uses fictional sample data stored only on this device. Food search and logging work offline."
            : "Food search and logging work offline. AI chat sends messages to an online provider only when you choose to use it. Confirmed food logs, targets, and account details sync to the server. Health history stays on this device. If you enable diary sharing in Ember, the selected day’s activity summary also goes to the online AI provider. Account export includes this device’s saved health history; deleting the account removes it here."}
        </T>
      </Card>
      <Card>
        <T bold>Take your data with you</T>
        <T color={C.muted}>
          Export your account details, food diary, water logs, and progress as
          JSON.
        </T>
        <Button
          secondary
          title="Export my data"
          loading={busy}
          onPress={() => void exportData()}
        />
      </Card>
      <Card>
        <T bold>Food information</T>
        <T color={C.muted} size={13}>
          Offline food data: USDA FoodData Central, FNDDS 2021–2023 (October
          2024 release). Custom food values are entered by you.
        </T>
      </Card>
      {error && <Banner error text={error} />}
      {message && <Banner text={message} />}
      {deleting ? (
        <Card>
          <T bold color={C.danger}>
            Permanently delete your account?
          </T>
          <T color={C.muted}>
            {u?.id === "fitlens-offline-demo"
              ? "This removes the local demo data and your demo edits. Exploring the demo again will create fresh sample data."
              : "This removes your server account and synced logs, plus this device’s cached diary. Previously exported health records remain in your health app."}
          </T>
          {u?.id !== "fitlens-offline-demo" && (
            <Field
              label="Confirm your password"
              value={password}
              onChange={setPassword}
              secure
            />
          )}
          <Button
            danger
            title="Delete account permanently"
            loading={busy}
            onPress={() => void remove()}
          />
          <Button
            secondary
            title="Keep my account"
            onPress={() => setDeleting(false)}
          />
        </Card>
      ) : (
        <Button
          secondary
          title="Delete my account"
          onPress={() => setDeleting(true)}
        />
      )}
    </Page>
  );
}
