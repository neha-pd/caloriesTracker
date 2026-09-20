import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Colors, Motion, Radius, Spacing, Typography } from '../../constants/theme';
import { Icons, IconName } from '../../constants/icons';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  icon?: IconName;
  secure?: boolean;
}

/**
 * Text input with an animated focus border (color transition — a two-state
 * change, so a Reanimated CSS transition, no shared value).
 */
export function Input({ label, error, icon, secure, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  const borderColor = error ? Colors.danger : focused ? Colors.primary : Colors.borderStrong;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.field,
          {
            borderColor,
            transitionProperty: 'borderColor',
            transitionDuration: Motion.duration.fast,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? Colors.primary : Colors.textMuted} />
        ) : null}
        <TextInput
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...rest}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Ionicons name={hidden ? Icons.eye : Icons.eyeOff} size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text variant="caption" color={Colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  label: {
    marginLeft: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.lg,
    height: '100%',
  },
  error: {
    marginLeft: Spacing.xs,
  },
});
