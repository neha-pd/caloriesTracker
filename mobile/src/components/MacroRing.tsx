import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Motion, Typography } from '@/constants/theme';
import { AnimatedNumber, Text } from '@/components/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size:       number;
  percentage: number;  // 0–100
  color:      string;
  label:      string;
  value?:     string;
  goal?:      string;
  delay?:     number;  // stagger offset when several rings mount together
}

export default function MacroRing({ size, percentage, color, label, value, goal, delay = 0 }: Props) {
  const stroke    = size * 0.095;
  const radius    = (size - stroke) / 2;
  const cx        = size / 2;
  const cy        = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct    = Math.min(100, Math.max(0, percentage));

  // Ring sweep runs on the UI thread via animatedProps on strokeDashoffset.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        delay,
        withTiming(clampedPct / 100, {
          duration: Motion.duration.slow,
          easing: Motion.easing.out,
          reduceMotion: ReduceMotion.System,
        })
      )
    );
  }, [clampedPct, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={Colors.bgElevated}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Center text (for hero ring) */}
      {!label && (
        <View style={[styles.center, { width: size, height: size }]}>
          <AnimatedNumber value={clampedPct} suffix="%" style={[styles.pct, { color }]} />
        </View>
      )}

      {/* Label below (for small macro rings) */}
      {label ? (
        <View style={styles.meta}>
          {value && (
            <Text variant="body" weight="bold" color={color} style={styles.tight}>
              {value}
            </Text>
          )}
          {goal && (
            <Text variant="caption" color={Colors.textMuted} style={styles.tight}>
              {goal}
            </Text>
          )}
          <Text variant="caption" color={Colors.textSecondary} style={styles.tight}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    textAlign: 'center',
  },
  meta: { alignItems: 'center', marginTop: 6, gap: 1 },
  tight: { lineHeight: undefined },
});
