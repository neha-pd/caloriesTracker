import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors, Radius, Shadows, Spacing } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ children, onPress, padded = true, elevated, style, testID }: Props) {
  const cardStyle = [
    styles.base,
    padded && styles.padded,
    elevated && { backgroundColor: Colors.bgElevated, ...Shadows.subtle },
    style,
  ];
  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} scaleTo={0.98} style={cardStyle} testID={testID}>
        {children}
      </AnimatedPressable>
    );
  }
  return (
    <View style={cardStyle} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padded: {
    padding: Spacing.md,
  },
});
