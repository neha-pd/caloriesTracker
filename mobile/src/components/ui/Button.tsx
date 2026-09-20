import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, HapticStyle } from './AnimatedPressable';
import { Text } from './Text';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import type { IconName } from '../../constants/icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHTS: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const FONT: Record<Size, number> = { sm: Typography.size.sm, md: Typography.size.md, lg: Typography.size.lg };

const BG: Record<Variant, string> = {
  primary: Colors.primary,
  secondary: Colors.bgElevated,
  ghost: Colors.transparent,
  danger: Colors.dangerMuted,
};
const FG: Record<Variant, string> = {
  primary: Colors.textOnPrimary,
  secondary: Colors.textPrimary,
  ghost: Colors.textSecondary,
  danger: Colors.danger,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  fullWidth,
  haptic = 'light',
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      testID={testID}
      accessibilityRole="button"
      style={[
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: BG[variant],
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: Colors.borderStrong,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={FONT[size] + 4} color={FG[variant]} /> : null}
          <Text
            variant="body"
            weight="bold"
            color={FG[variant]}
            style={{ fontSize: FONT[size], lineHeight: undefined }}
          >
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
