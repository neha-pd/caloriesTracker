import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '../../constants/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Count-up number. Drives a read-only TextInput's text from a worklet via
 * useAnimatedProps, so the tick never re-renders React.
 *
 * A TextInput keeps the width it had at mount — animated text updates don't
 * re-run layout, so growing values get ellipsized ("1…"). An invisible Text
 * sibling rendering the widest of the current and previous target values
 * establishes the layout box; the input overlays it.
 */
export function AnimatedNumber({ value, suffix = '', prefix = '', duration = Motion.duration.slow, style }: Props) {
  const sv = useSharedValue(value);
  const prev = useRef(value);

  useEffect(() => {
    sv.set(
      withTiming(value, {
        duration,
        easing: Motion.easing.out,
        reduceMotion: ReduceMotion.System,
      })
    );
    prev.current = value;
  }, [value, duration, sv]);

  const animatedProps = useAnimatedProps(() => {
    const text = `${prefix}${Math.round(sv.get())}${suffix}`;
    return { text, defaultValue: text } as any;
  });

  // Size the box for whichever of the two endpoints renders wider, so
  // intermediate frames never clip while animating up or down.
  const current = `${prefix}${Math.round(value)}${suffix}`;
  const previous = `${prefix}${Math.round(prev.current)}${suffix}`;
  const sizer = previous.length > current.length ? previous : current;

  return (
    <View>
      <Text style={[style, styles.sizer]} numberOfLines={1}>
        {sizer}
      </Text>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        animatedProps={animatedProps}
        style={[StyleSheet.absoluteFill, styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sizer: {
    opacity: 0,
  },
  input: {
    padding: 0,
  },
});
