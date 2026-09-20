import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from './AnimatedPressable';
import { Text } from './Text';
import { Colors, Motion, Radius, Spacing } from '../../constants/theme';
import type { IconName } from '../../constants/icons';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  testID?: string;
}

export function Chip({ label, selected, onPress, icon, color = Colors.primary, testID }: Props) {
  const fg = selected ? color : Colors.textSecondary;
  const content = (
    <Animated.View
      style={[
        styles.base,
        {
          backgroundColor: selected ? Colors.primaryMuted : Colors.bgElevated,
          borderColor: selected ? color : Colors.borderStrong,
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: Motion.duration.fast,
        },
        selected && color !== Colors.primary && { backgroundColor: `${color}26` },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text variant="label" color={fg} weight={selected ? 'bold' : 'semibold'}>
        {label}
      </Text>
    </Animated.View>
  );
  if (!onPress) return content;
  return (
    <AnimatedPressable onPress={onPress} haptic="selection" testID={testID}>
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
