import React from "react";
import { Tabs, router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, Icon, T, Tap } from "../../src/features/ui";
export default function Layout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            paddingTop: 9,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: "#141812",
            borderTopWidth: 1,
            borderColor: C.border,
          }}
        >
          {[
            { name: "dashboard", title: "Today", icon: "home-outline" },
            { name: "history", title: "Progress", icon: "stats-chart-outline" },
            { name: "add", title: "Add food", icon: "add" },
            { name: "quests", title: "Quests", icon: "sparkles-outline" },
            { name: "profile", title: "You", icon: "person-outline" },
          ].map((tab) => {
            const active = state.routes[state.index].name === tab.name;
            return (
              <Tap
                key={tab.name}
                testID={"tab-" + tab.name}
                label={tab.title}
                onPress={() =>
                  tab.name === "add"
                    ? router.push("/log")
                    : navigation.navigate(tab.name)
                }
                style={{
                  minWidth: 55,
                  minHeight: 51,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  ...(tab.name === "add"
                    ? {
                        backgroundColor: C.lime,
                        borderRadius: 16,
                        minWidth: 50,
                      }
                    : {}),
                }}
              >
                <Icon
                  name={tab.icon as any}
                  size={23}
                  color={tab.name === "add" ? C.bg : active ? C.lime : C.muted}
                />
                {tab.name !== "add" && (
                  <T size={11} color={active ? C.lime : C.muted}>
                    {tab.title}
                  </T>
                )}
              </Tap>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="quests" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
