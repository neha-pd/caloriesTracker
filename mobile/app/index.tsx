import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
export default function Index() {
  const { user, isLoggedIn } = useAuthStore();
  return (
    <Redirect
      href={
        isLoggedIn
          ? user?.onboarding_complete
            ? "/(tabs)/dashboard"
            : "/onboarding"
          : "/(auth)/welcome"
      }
    />
  );
}
