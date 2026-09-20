import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AnimatedPressable, Button, Card, Screen, Text } from '@/components/ui';
import { Icons, type IconName } from '@/constants/icons';
import { Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose Weight',
  maintain: 'Maintain',
  gain_muscle: 'Gain Muscle',
};

const ACTIVITY_ICONS: Record<string, IconName> = {
  sedentary: Icons.activity.sedentary,
  light: Icons.activity.light,
  lightly_active: Icons.activity.light,
  moderate: Icons.activity.moderate,
  moderately_active: Icons.activity.moderate,
  active: Icons.activity.active,
  very_active: Icons.activity.veryActive,
};

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  value?: string | number | null;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <AnimatedPressable onPress={onPress} haptic="selection" disabled={!onPress}>
      <View style={[styles.row, !last && styles.rowDivider]}>
        <View style={styles.iconTile}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <Text variant="body" color={Colors.textPrimary} style={styles.rowLabel}>
          {label}
        </Text>
        <Text variant="body" weight="semibold" color={Colors.textSecondary}>
          {value ?? '—'}
        </Text>
        {onPress ? (
          <Ionicons name={Icons.chevronForward} size={16} color={Colors.textMuted} />
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  // Refresh user data from API whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const goEditGoals = () => router.push('/edit-goals');
  const goEditProfile = () => router.push('/edit-profile');

  const activityIcon = ACTIVITY_ICONS[user?.activity_level ?? ''] ?? Icons.activity.moderate;

  return (
    <Screen scroll>
      {/* ── Header ── */}
      <Animated.View
        entering={FadeInDown.duration(Motion.duration.base)}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text variant="heading">{user?.display_name ?? 'User'}</Text>
        <Text variant="label" style={styles.email}>
          {user?.email}
        </Text>
      </Animated.View>

      {/* ── Daily Goals ── */}
      <Animated.View entering={FadeInDown.duration(Motion.duration.base).delay(40)}>
        <View style={styles.sectionHeader}>
          <Text variant="label">Daily Goals</Text>
          <AnimatedPressable onPress={goEditGoals} haptic="selection" hitSlop={8}>
            <View style={styles.editLink}>
              <Ionicons name={Icons.edit} size={12} color={Colors.primary} />
              <Text variant="label" color={Colors.primary}>
                Edit
              </Text>
            </View>
          </AnimatedPressable>
        </View>
        <Card padded={false} style={styles.card}>
          {user?.goal_type && (
            <Row
              icon={Icons.goal}
              label="Goal Type"
              value={GOAL_LABELS[user.goal_type] ?? user.goal_type}
              onPress={goEditGoals}
            />
          )}
          <Row
            icon={Icons.calories}
            label="Calories"
            value={`${user?.calorie_goal ?? 2000} kcal`}
            onPress={goEditGoals}
          />
          <Row
            icon={Icons.protein}
            label="Protein"
            value={`${user?.protein_goal_g ?? 150} g`}
            onPress={goEditGoals}
          />
          <Row
            icon={Icons.carbs}
            label="Carbs"
            value={`${user?.carbs_goal_g ?? 200} g`}
            onPress={goEditGoals}
          />
          <Row
            icon={Icons.fat}
            label="Fat"
            value={`${user?.fat_goal_g ?? 65} g`}
            onPress={goEditGoals}
            last
          />
        </Card>
      </Animated.View>

      {/* ── Physical Profile ── */}
      <Animated.View entering={FadeInDown.duration(Motion.duration.base).delay(80)}>
        <View style={styles.sectionHeader}>
          <Text variant="label">Physical Profile</Text>
          <AnimatedPressable onPress={goEditProfile} haptic="selection" hitSlop={8}>
            <View style={styles.editLink}>
              <Ionicons name={Icons.edit} size={12} color={Colors.primary} />
              <Text variant="label" color={Colors.primary}>
                Edit
              </Text>
            </View>
          </AnimatedPressable>
        </View>
        <Card padded={false} style={styles.card}>
          <Row
            icon={Icons.calendar}
            label="Age"
            value={user?.age ? `${user.age} yrs` : undefined}
            onPress={goEditProfile}
          />
          <Row
            icon={Icons.height}
            label="Height"
            value={user?.height_cm ? `${user.height_cm} cm` : undefined}
            onPress={goEditProfile}
          />
          <Row
            icon={Icons.weight}
            label="Weight"
            value={user?.weight_kg ? `${user.weight_kg} kg` : undefined}
            onPress={goEditProfile}
          />
          <Row
            icon={activityIcon}
            label="Activity"
            value={user?.activity_level?.replace(/_/g, ' ') ?? undefined}
            onPress={goEditProfile}
            last
          />
        </Card>
      </Animated.View>

      {/* ── Actions ── */}
      <Animated.View
        entering={FadeInDown.duration(Motion.duration.base).delay(120)}
        style={styles.actions}
      >
        <Button
          title="Edit Profile"
          onPress={goEditProfile}
          variant="secondary"
          icon={Icons.person}
          fullWidth
        />
        <Button
          title="Edit Goals"
          onPress={goEditGoals}
          variant="secondary"
          icon={Icons.edit}
          fullWidth
        />
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="danger"
          icon={Icons.logout}
          haptic="medium"
          fullWidth
          testID="signout-button"
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.heavy,
    color: Colors.primary,
  },
  email: {
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
  },
});
