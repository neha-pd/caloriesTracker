import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';
import {
  AnimatedNumber,
  AnimatedPressable,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLogStore } from '@/store/logStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import MacroRing from '@/components/MacroRing';
import MealSection, { MEAL_ORDER } from '@/components/MealSection';
import WaterTracker from '@/components/WaterTracker';
import MicronutrientsCard from '@/components/MicronutrientsCard';
import NutrientBreakdownSheet, { BreakdownNutrient, formatNutrient } from '@/components/NutrientBreakdownSheet';

// ── Goal type display config ─────────────────────────────────────────────
const GOAL_CONFIG: Record<string, { label: string; icon: IconName; color: string }> = {
  lose_weight: { label: 'Fat Loss',    icon: Icons.streak,  color: Colors.danger },
  maintain:    { label: 'Maintain',    icon: Icons.weight,  color: Colors.announcement },
  gain_muscle: { label: 'Gain Muscle', icon: Icons.protein, color: Colors.primary },
};
const GOAL_FALLBACK = { label: 'Custom', icon: Icons.goal, color: Colors.primary };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Skeleton layout mirroring the hero card + rings row while first load is in flight. */
function DashboardSkeleton() {
  return (
    <View>
      <View style={styles.header}>
        <View style={{ gap: Spacing.sm }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={180} height={22} />
        </View>
        <Skeleton width={64} height={32} radius={Radius.pill} />
      </View>
      <Skeleton height={196} radius={Radius.lg} style={{ marginBottom: Spacing.lg }} />
      <Skeleton width={160} height={20} style={{ marginBottom: Spacing.md }} />
      <View style={styles.skeletonRings}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={85} height={85} radius={42.5} />
        ))}
      </View>
      <Skeleton height={150} radius={Radius.lg} style={{ marginBottom: Spacing.lg }} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={76} radius={Radius.lg} style={{ marginBottom: Spacing.sm }} />
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const router       = useRouter();
  const user         = useAuthStore((s) => s.user);
  const dashboard    = useLogStore((s) => s.dashboard);
  const setDashboard = useLogStore((s) => s.setDashboard);
  const [breakdown, setBreakdown] = useState<BreakdownNutrient | null>(null);

  const { refetch, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'today'],
    // The signal lets mutations cancel an in-flight refetch before it can
    // overwrite their optimistic update with stale values.
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/api/dashboard/today', { signal });
      setDashboard(data);
      return data;
    },
    refetchInterval: 30000,
  });

  // The spinner reflects only a user's pull. Background refetches (interval,
  // after logging water/food) stay silent — otherwise the RefreshControl pops
  // in and shifts the whole screen.
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  };

  // Entrance builders — one per section, staggered top to bottom.
  const entering = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => FadeInDown.duration(Motion.duration.base).delay(i * 50)),
    []
  );

  const d = dashboard;

  const goalCfg    = GOAL_CONFIG[user?.goal_type ?? ''] ?? GOAL_FALLBACK;
  const goalCal    = d?.goals?.calories ?? user?.calorie_goal ?? 2000;
  const eaten      = Math.round(d?.consumed?.calories ?? 0);
  const remaining  = Math.max(0, goalCal - eaten);
  const pct        = Math.min(100, Math.round((eaten / goalCal) * 100));
  const overBudget = eaten > goalCal;

  // Values use the breakdown sheet's formatter so the ring and the sheet's
  // headline total always read identically.
  const macros = (['protein_g', 'carbs_g', 'fat_g'] as const).map((key) => ({
    key,
    label: { protein_g: 'Protein', carbs_g: 'Carbs', fat_g: 'Fat' }[key],
    color: { protein_g: Colors.protein, carbs_g: Colors.carbs, fat_g: Colors.fat }[key],
    pct:   d?.percentage?.[key] ?? 0,
    value: `${formatNutrient(Number(d?.consumed?.[key] ?? 0), key)}g`,
    goal:  `/ ${d?.goals?.[key] ?? 0}g`,
  }));

  let body: React.ReactNode;
  if (isLoading && !d) {
    body = <DashboardSkeleton />;
  } else if (isError && !d) {
    body = (
      <EmptyState
        icon={Icons.calories}
        title="Couldn't load your day"
        subtitle="Check your connection and try again."
        action={{ title: 'Retry', onPress: () => refetch() }}
      />
    );
  } else {
    body = (
      <>
        {/* ── Header ── */}
        <Animated.View entering={entering[0]} style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="label" numberOfLines={1} adjustsFontSizeToFit>
              {greeting()},
            </Text>
            <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
              {user?.display_name ?? user?.email?.split('@')[0] ?? 'friend'}
            </Text>
          </View>
          <View style={styles.streakBadge} testID="streak-badge">
            <Ionicons name={Icons.streak} size={16} color={Colors.primary} />
            <Text variant="body" weight="bold" color={Colors.primary}>
              {d?.streak_days ?? 0}
            </Text>
          </View>
        </Animated.View>

        {/* ── Calorie Hero Card ── */}
        <Animated.View entering={entering[1]}>
          <Card
            padded={false}
            style={styles.heroCard}
            onPress={() => router.push('/edit-goals')}
            testID="calorie-hero"
          >
            <LinearGradient
              colors={[Colors.bgCard, Colors.bgElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.heroInner}
            >
              {/* Goal type badge */}
              <View
                style={[
                  styles.goalBadge,
                  { backgroundColor: goalCfg.color + '22', borderColor: goalCfg.color + '55' },
                ]}
              >
                <Ionicons name={goalCfg.icon} size={13} color={goalCfg.color} />
                <Text variant="label" weight="bold" color={goalCfg.color}>
                  {goalCfg.label}
                </Text>
                <Ionicons name={Icons.edit} size={11} color={goalCfg.color} />
              </View>

              {/* Main calorie numbers */}
              <View style={styles.heroNumbers}>
                <AnimatedPressable
                  onPress={() => setBreakdown('calories')}
                  haptic="selection"
                  style={styles.heroStat}
                  accessibilityRole="button"
                  accessibilityLabel="Show calorie breakdown"
                  testID="calories-breakdown"
                >
                  <AnimatedNumber
                    value={eaten}
                    style={[
                      styles.heroStatBig,
                      { color: overBudget ? Colors.danger : Colors.textPrimary },
                    ]}
                  />
                  <View style={styles.heroStatHint}>
                    <Text variant="label" color={Colors.textMuted} style={styles.heroStatUnit}>
                      kcal eaten
                    </Text>
                    <Ionicons name={Icons.chevronForward} size={12} color={Colors.textMuted} style={styles.heroStatUnit} />
                  </View>
                </AnimatedPressable>

                <Text style={styles.heroSlashText}>/</Text>

                <View style={styles.heroStat}>
                  <Text style={styles.heroStatBig}>{goalCal.toLocaleString()}</Text>
                  <Text variant="label" color={Colors.textMuted} style={styles.heroStatUnit}>
                    kcal goal
                  </Text>
                </View>
              </View>

              {/* Progress */}
              <ProgressBar
                progress={goalCal > 0 ? eaten / goalCal : 0}
                color={overBudget ? Colors.danger : goalCfg.color}
                trackColor={Colors.bgCardMid}
              />

              {/* Remaining row */}
              <View style={styles.remainingRow}>
                <Text
                  variant="label"
                  color={overBudget ? Colors.danger : Colors.textSecondary}
                >
                  {overBudget
                    ? `${(eaten - goalCal).toLocaleString()} kcal over budget`
                    : `${remaining.toLocaleString()} kcal remaining`}
                </Text>
                <Text variant="label" weight="bold" color={Colors.textMuted}>
                  {pct}%
                </Text>
              </View>
            </LinearGradient>
          </Card>
        </Animated.View>

        {/* ── Macro Rings ── */}
        <Animated.View entering={entering[2]}>
          <View style={styles.sectionHeader}>
            <Text variant="subheading">Macronutrients</Text>
            <Text variant="caption">Tap for breakdown</Text>
          </View>
          <Card style={styles.macroRow} padded={false}>
            {macros.map((m, i) => (
              <AnimatedPressable
                key={m.key}
                onPress={() => setBreakdown(m.key)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={`Show ${m.label.toLowerCase()} breakdown`}
                testID={`macro-${m.key}`}
              >
                <MacroRing
                  size={85}
                  percentage={m.pct}
                  color={m.color}
                  label={m.label}
                  value={m.value}
                  goal={m.goal}
                  delay={i * 80}
                />
              </AnimatedPressable>
            ))}
          </Card>

          <MicronutrientsCard micronutrients={d?.micronutrients} entryCount={d?.entry_count ?? 0} />
        </Animated.View>

        {/* ── Water ── */}
        <Animated.View entering={entering[3]}>
          <WaterTracker
            waterMl={d?.water_ml ?? 0}
            onUpdate={refetch}
            waterGoalMl={user?.weight_kg ? Math.round(user.weight_kg * 35) : undefined}
          />
        </Animated.View>

        {/* ── Meals ── */}
        <Animated.View entering={entering[4]}>
          <View style={styles.sectionHeader}>
            <Text variant="subheading">Today's Meals</Text>
          </View>

          {MEAL_ORDER.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              data={d?.meals?.[meal]}
              onAdd={() => router.push({ pathname: '/log', params: { meal_type: meal } })}
            />
          ))}
        </Animated.View>
      </>
    );
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      testID="dashboard-screen"
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onPullRefresh} tintColor={Colors.primary} />
      }
    >
      {body}
      <NutrientBreakdownSheet nutrient={breakdown} dashboard={d} onClose={() => setBreakdown(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerText: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },

  heroCard: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  heroInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },

  heroNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  heroStat: {
    alignItems: 'flex-start',
  },
  heroStatBig: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  heroStatUnit: {
    marginTop: 2,
  },
  heroStatHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heroSlashText: {
    fontSize: 32,
    color: Colors.borderStrong,
    fontWeight: '200',
    paddingHorizontal: Spacing.xs,
  },

  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },

  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },

  skeletonRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
});
