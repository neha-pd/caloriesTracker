import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Motion, Radius, Typography } from '../../src/constants/theme';
import { Text } from '../../src/components/ui';

const TABS: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap; label: string }> = {
  dashboard: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  history:   { icon: 'stats-chart-outline', iconFocused: 'stats-chart', label: 'History' },
  profile:   { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
};

const PILL_INSET = 10;

/**
 * Floating pill tab bar with a sliding indicator. The indicator is absolutely
 * positioned with no children — the sanctioned width animation — and moves with
 * ease-in-out because it travels across the bar rather than entering/leaving.
 * Tab content itself switches instantly (tabs are peers, no slide).
 */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 8 : 16;

  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = useSharedValue(0);

  useEffect(() => {
    const l = layouts[state.index];
    if (!l) return;
    const targetX = l.x + PILL_INSET;
    const targetW = l.width - PILL_INSET * 2;
    if (ready.get() === 0) {
      // First layout: place the pill without motion.
      x.set(targetX);
      w.set(targetW);
      ready.set(1);
      return;
    }
    const cfg = { duration: 250, easing: Motion.easing.inOut, reduceMotion: ReduceMotion.System };
    x.set(withTiming(targetX, cfg));
    w.set(withTiming(targetW, cfg));
  }, [state.index, layouts, x, w, ready]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: w.get(),
    opacity: ready.get(),
  }));

  return (
    <View style={[styles.bar, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.indicator, pillStyle]} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TABS[route.name] ?? { icon: 'ellipse-outline', iconFocused: 'ellipse', label: route.name };

        const onLayout = (e: LayoutChangeEvent) => {
          const { x: lx, width } = e.nativeEvent.layout;
          setLayouts((prev) => ({ ...prev, [index]: { x: lx, width } }));
        };

        const onPress = () => {
          Haptics.selectionAsync();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLayout={onLayout}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            testID={`tab-${route.name}`}
          >
            <Ionicons
              name={focused ? tab.iconFocused : tab.icon}
              size={22}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
            <Text
              variant="caption"
              weight="semibold"
              color={focused ? Colors.primary : Colors.textMuted}
              style={styles.label}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 68,
    borderRadius: Radius.pill,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 20,
  },
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 0,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryMuted,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    letterSpacing: 0.2,
    fontSize: 11,
    lineHeight: 13,
  },
});
