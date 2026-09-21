import React, { useEffect, useState } from "react";
import { AppState, Linking, Modal, Platform, View } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../../lib/api";
import { Banner, Button, C, T } from "../ui";
import { AppRelease, needsUpdate, validRelease } from "./domain";
const key = "fitlens:required-release:v1";
export default function UpdateGate() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const installed = Constants.nativeAppVersion || Constants.expoConfig?.version || "0.0.0";
  async function check() {
    if (Platform.OS !== "android") return;
    setChecking(true);
    try {
      const response = await fetch(`${BASE_URL}/api/app-release`, {signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw Error();
      const value = (await response.json()).android;
      if (validRelease(value)) {
        setRelease(value);
        await AsyncStorage.setItem(key, JSON.stringify(value));
        setMessage(needsUpdate(installed, value) ? "After downloading, open the APK and approve the Android update. Your saved data stays on this phone." : "");
      }
    } catch { setMessage("Couldn’t check right now. You can still download the update below, or try again when you’re online."); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    if (Platform.OS !== "android") return;
    // Read first, then refresh: an older cache must never overwrite the network response.
    void AsyncStorage.getItem(key).then((raw) => {
      try { const value = raw ? JSON.parse(raw) : null; if (validRelease(value)) setRelease(value); } catch {}
    }).catch(() => {}).finally(() => void check());
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void check(); });
    const timer = setInterval(() => void check(), 300_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  if (Platform.OS !== "android" || !release || !needsUpdate(installed, release)) return null;
  return <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
    <View style={{flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 28, gap: 20}} testID="required-update">
      <T color={C.lime} bold>FITLENS UPDATE</T>
      <T bold size={30}>A fresh FitLens is ready.</T>
      <T>Update to {release.version} to continue. You’re using {installed}.</T>
      <T color={C.muted}>Download the new version, then tap Install when Android asks. Don’t uninstall FitLens—updating keeps your sign-in and saved logs.</T>
      <Button title="Download update" onPress={() => { void Linking.openURL(release.url).catch(() => setMessage("Couldn’t open the download. Check your internet connection and try again.")); }} />
      <Button secondary title="Check again" loading={checking} onPress={() => void check()} />
      {!!message && <Banner text={message} />}
    </View>
  </Modal>;
}
