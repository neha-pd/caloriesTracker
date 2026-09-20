import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { Colors, Spacing } from '../../constants/theme';
import type { IconName } from '../../constants/icons';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  action?: { title: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={Colors.textMuted} />
      </View>
      <Text variant="subheading" center>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" center style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {action ? (
        <Button title={action.title} onPress={action.onPress} variant="secondary" size="sm" style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    maxWidth: 280,
  },
  action: {
    marginTop: Spacing.sm,
  },
});
