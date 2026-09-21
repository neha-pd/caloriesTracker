import { removeRetiredModels } from "../src/features/retiredModels";
import React, { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans";
import { useAuthStore } from "../src/store/authStore";
import { useTracker } from "../src/features/tracker";
import { useHealth } from "../src/features/health/store";
import "../src/features/reminders";
import { WidgetBridge } from "../src/features/widgets";
import NotificationBridge from "../src/features/notificationBridge";
import { C } from "../src/features/ui";
const client = new QueryClient();
export default function Layout() {
  const [fonts, fontError] = useFonts({
    Manrope_800ExtraBold,
    DMSans_400Regular,
  });
  const auth = useAuthStore();
  const segments = useSegments();
  useEffect(() => {
    void auth.loadSession();
    void removeRetiredModels();
  }, []);
  useEffect(() => {
    if (auth.isLoading) return;
    const group = segments[0];
    if (!auth.isLoggedIn && group !== "(auth)")
      router.replace("/(auth)/welcome");
    else if (
      auth.isLoggedIn &&
      !auth.user?.onboarding_complete &&
      group !== "onboarding"
    )
      router.replace("/onboarding");
    else if (
      auth.isLoggedIn &&
      auth.user?.onboarding_complete &&
      (group === "(auth)" || !group)
    )
      router.replace("/(tabs)/dashboard");
  }, [
    auth.isLoading,
    auth.isLoggedIn,
    auth.user?.onboarding_complete,
    segments,
  ]);
  useEffect(() => {
    if (!auth.user?.id) return;
    void useTracker
      .getState()
      .initialize(auth.user.id)
      .then(() => useHealth.getState().initialize(auth.user!.id))
      .then(() => useHealth.getState().sync());
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active")
        void useTracker
          .getState()
          .sync()
          .then(() => useHealth.getState().sync());
    });
    const timer = setInterval(
      () =>
        void useTracker
          .getState()
          .sync()
          .then(() => useHealth.getState().sync()),
      30000,
    );
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [auth.user?.id]);
  if (auth.isLoading || (!fonts && !fontError))
    return (
      <View
        style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}
      >
        <ActivityIndicator color={C.lime} />
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <QueryClientProvider client={client}>
        <StatusBar style="light" />
        <NotificationBridge />
        <WidgetBridge />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen
            name="chat"
            options={{
              presentation: "transparentModal",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
