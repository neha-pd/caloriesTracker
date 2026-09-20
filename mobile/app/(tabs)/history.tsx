import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import api from '@/lib/api';
import { localDateKey, parseDateKey, toDateKey } from '@/lib/dates';

/**
 * History rows arrive keyed by calendar day ('YYYY-MM-DD', one per date).
 * Normalise defensively (older API builds sent ISO timestamps) and drop any
 * row whose date can't be parsed rather than rendering "Invalid Date".
 */
type HistoryLog = {
  log_date: string;
  total_calories: number | string;
  total_protein_g: number | string;
  total_carbs_g: number | string;
  total_fat_g: number | string;
  calorie_goal: number;
};

function normaliseLogs(raw: any[]): (HistoryLog & { date: Date })[] {
  const byDay = new Map<string, HistoryLog & { date: Date }>();
  for (const log of raw) {
    const key = toDateKey(log?.log_date);
    const date = parseDateKey(key);
    if (!key || !date) continue;
    byDay.set(key, { ...log, log_date: key, date });
  }
  return [...byDay.values()].sort((a, b) => a.log_date.localeCompare(b.log_date));
}

function dayLabel(date: Date, today: string) {
  const key = localDateKey(date);
  if (key === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDateKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * One chart bar. The fill is an absolutely-positioned, childless, bottom-anchored
 * Animated.View inside a fixed-height track — the one case where animating
 * `height` is fine (no sibling re-layout). Staggered by index.
 */
function Bar({ pct, isToday, index }: { pct: number; isToday: boolean; index: number }) {
  const h = useSharedValue(0);

  useEffect(() => {
    h.set(
      withDelay(
        index * 40,
        withTiming(Math.min(Math.max(pct, 0), 100), {
          duration: Motion.duration.slow,
          easing: Motion.easing.out,
          reduceMotion: ReduceMotion.System,
        })
      )
    );
  }, [pct, index, h]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${h.get()}%`,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          { backgroundColor: isToday ? Colors.primary : Colors.primaryMuted },
          fillStyle,
        ]}
      />
    </View>
  );
}

/** Skeleton chart shown while history loads. */
function ChartSkeleton() {
  const heights = [56, 88, 40, 96, 72, 48, 80];
  return (
    <Card style={styles.chartCard}>
      <Skeleton width={110} height={16} />
      <View style={styles.bars}>
        {heights.map((barHeight, i) => (
          <View key={i} style={styles.barWrap}>
            <View style={styles.skeletonTrack}>
              <Skeleton width="100%" height={barHeight} radius={Radius.sm} />
            </View>
            <Skeleton width={24} height={10} radius={Radius.xs} />
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function HistoryScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard/history');
      return data;
    },
  });

  const today = localDateKey();
  const logs = normaliseLogs(data?.logs ?? []);
  const maxCal = logs.reduce((m, l) => Math.max(m, Number(l.total_calories) || 0), 1);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title">Progress History</Text>
        <Text variant="label" style={styles.subtitle}>
          Last 7 days
        </Text>
      </View>

      {isLoading ? (
        <ChartSkeleton />
      ) : logs.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(Motion.duration.base)}>
          <Card style={styles.chartCard}>
            <Text variant="subheading">Daily Calories</Text>
            <View style={styles.bars}>
              {logs.map((log, i) => {
                const cal = Number(log.total_calories) || 0;
                const pct = (cal / maxCal) * 100;
                const isToday = log.log_date === today;
                const day = log.date.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <View key={log.log_date} style={styles.barWrap}>
                    <Text variant="caption" center color={isToday ? Colors.primary : Colors.textMuted}>
                      {Math.round(cal)}
                    </Text>
                    <Bar pct={pct} isToday={isToday} index={i} />
                    <Text
                      variant="caption"
                      center
                      color={isToday ? Colors.textPrimary : Colors.textSecondary}
                      weight={isToday ? 'bold' : 'medium'}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {logs.map((log, i) => {
        const cal = Math.round(Number(log.total_calories) || 0);
        const onTrack = Number(log.total_calories) <= log.calorie_goal;
        const badgeColor = onTrack ? Colors.primary : Colors.danger;
        return (
          <Animated.View
            key={log.log_date}
            entering={FadeInDown.duration(Motion.duration.base).delay(i * 40)}
          >
            <Card style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayTitle}>
                  <Text variant="body" color={Colors.textPrimary} weight="medium">
                    {dayLabel(log.date, today)}
                  </Text>
                  <Text variant="caption">
                    {log.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View
                  style={[
                    styles.calBadge,
                    {
                      borderColor: badgeColor,
                      backgroundColor: onTrack ? Colors.primaryMuted : Colors.dangerMuted,
                    },
                  ]}
                >
                  <Text variant="caption" weight="bold" color={badgeColor}>
                    {cal} kcal
                  </Text>
                </View>
              </View>
              <View style={styles.macroRow}>
                {[
                  { label: 'Protein', val: Number(log.total_protein_g), color: Colors.protein },
                  { label: 'Carbs', val: Number(log.total_carbs_g), color: Colors.carbs },
                  { label: 'Fat', val: Number(log.total_fat_g), color: Colors.fat },
                ].map(({ label, val, color }) => (
                  <View key={label} style={styles.macroItem}>
                    <Text variant="body" weight="bold" color={color}>
                      {Math.round(val ?? 0)}g
                    </Text>
                    <Text variant="caption">{label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        );
      })}

      {!isLoading && logs.length === 0 && (
        <EmptyState
          icon="stats-chart-outline"
          title="No logged days yet"
          subtitle="Start tracking today!"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  chartCard: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
    height: 120,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.sm,
    minHeight: 4,
  },
  skeletonTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  dayCard: {
    marginBottom: Spacing.sm,
  },
  dayTitle: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  calBadge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  macroItem: {
    alignItems: 'center',
  },
});
