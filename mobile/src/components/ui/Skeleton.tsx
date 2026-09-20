import React, { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Loading placeholder — opacity pulse loop (transform/opacity only, UI thread). */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: Props) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) return;
    opacity.set(
      withRepeat(
        withTiming(1, { duration: 700, reduceMotion: ReduceMotion.System }),
        -1,
        true
      )
    );
  }, [reduced, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: Colors.bgCardMid },
        pulse,
        style,
      ]}
    />
  );
}
