import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Motion, Radius } from '../../constants/theme';

interface Props {
  progress: number; // 0–1
  color?: string;
  trackColor?: string;
  height?: number;
  animated?: boolean;
}

/**
 * Animated fill. The fill is absolutely positioned with no children — the one
 * case where animating `width` is fine (no sibling re-layout) and it keeps the
 * corner radius that `scaleX` would smear.
 */
export function ProgressBar({
  progress,
  color = Colors.primary,
  trackColor = Colors.bgCardMid,
  height = 8,
  animated = true,
}: Props) {
  const pct = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.min(Math.max(progress, 0), 1) * 100;
    if (animated) {
      pct.set(
        withTiming(clamped, {
          duration: Motion.duration.slow,
          easing: Motion.easing.out,
          reduceMotion: ReduceMotion.System,
        })
      );
    } else {
      pct.set(clamped);
    }
  }, [progress, animated, pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${pct.get()}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: height / 2 },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    borderRadius: Radius.pill,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
