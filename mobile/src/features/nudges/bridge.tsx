import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useTracker } from "../tracker";
import { useHealth } from "../health/store";
import { useNudges, refreshNudgeContext } from "./store";
import { nudgeNative } from "./native";
export default function NudgeBridge() {
  const user = useAuthStore((s) => s.user),
    t = useTracker(),
    h = useHealth();
  useEffect(() => {
    if (user?.id)
      void useNudges
        .getState()
        .initialize(user.id)
        .catch(() => {});
  }, [user?.id]);
  useEffect(() => {
    const timer = setTimeout(
      () => void refreshNudgeContext().catch(() => {}),
      300,
    );
    return () => clearTimeout(timer);
  }, [t.uid, t.entries, t.water, t.fitness, h.days, h.enabled, user]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      void refreshNudgeContext()
        .then(() => {
          if (s === "active") return nudgeNative()?.checkNow();
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);
  return null;
}
