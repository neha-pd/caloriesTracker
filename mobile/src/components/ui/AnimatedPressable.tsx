import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle, PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Motion } from '../../constants/theme';

export type HapticStyle = 'none' | 'selection' | 'light' | 'medium' | 'success' | 'error';

interface Props extends Omit<PressableProps, 'style'> {
  onPress?: () => void;
  haptic?: HapticStyle;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  /** Layout for the outer touch target (e.g. `flex: 1` in a row). `style` styles the visual box inside it. */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

function fireHaptic(haptic: HapticStyle) {
  switch (haptic) {
    case 'selection': Haptics.selectionAsync(); break;
    case 'light': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
    case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
    case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
    case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
  }
}

/**
 * Foundation pressable: scale-down on press-in (Reanimated CSS transition —
 * two-state change, so no shared value needed), optional haptic fired with the
 * commit. All other pressable primitives build on this.
 */
export function AnimatedPressable({
  onPress,
  haptic = 'none',
  scaleTo = 0.97,
  disabled,
  style,
  containerStyle,
  children,
  ...rest
}: Props) {
  // Hand pointer wherever a pointer exists (web, iPad trackpad, Mac).
  const cursor: ViewStyle = { cursor: disabled ? 'auto' : 'pointer' };

  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={() => {
        if (haptic !== 'none') fireHaptic(haptic);
        onPress?.();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      hitSlop={4}
      pressRetentionOffset={16}
      style={[cursor, containerStyle]}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          cursor,
          {
            transform: [{ scale: pressed && !disabled ? scaleTo : 1 }],
            // opacity too, so disabled/enabled toggles fade instead of blinking
            transitionProperty: ['transform', 'opacity'],
            transitionDuration: Motion.duration.press,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
