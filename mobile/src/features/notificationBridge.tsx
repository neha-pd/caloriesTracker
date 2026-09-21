import type { NotificationResponse } from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../store/authStore";
export default function NotificationBridge() {
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void import("expo-notifications")
      .then((N) => {
        if (!active) return;
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        if (!user?.onboarding_complete) return;
        const handle = (response: NotificationResponse | null) => {
          if (!active || !response) return;
          const data = response.notification.request.content.data;
          if (data?.fitlens !== true) return;
          const route = data.route;
          N.clearLastNotificationResponse();
          if (
            route === "/coach" ||
            route === "/log" ||
            route === "/water" ||
            route === "/(tabs)/quests"
          )
            router.push(route);
        };
        subscription = N.addNotificationResponseReceivedListener(handle);
        void N.getLastNotificationResponseAsync().then(handle);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [user?.id, user?.onboarding_complete]);
  return null;
}
