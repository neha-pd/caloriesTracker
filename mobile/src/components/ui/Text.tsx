import React from 'react';
import { Text as RNText, TextProps, TextStyle, StyleProp } from 'react-native';
import { Colors, Typography, TextVariant } from '../../constants/theme';

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  weight?: keyof typeof Typography.weight;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

const VARIANTS: Record<TextVariant, TextStyle> = {
  hero: {
    fontSize: Typography.size.hero,
    lineHeight: Typography.lineHeight.hero,
    fontWeight: Typography.weight.heavy,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: Typography.size.xxl,
    lineHeight: Typography.lineHeight.xxl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  heading: {
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  subheading: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.regular,
    color: Colors.textSecondary,
  },
  label: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.textMuted,
  },
};

export function Text({ variant = 'body', color, weight, center, style, ...rest }: Props) {
  return (
    <RNText
      style={[
        VARIANTS[variant],
        color ? { color } : null,
        weight ? { fontWeight: Typography.weight[weight] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
