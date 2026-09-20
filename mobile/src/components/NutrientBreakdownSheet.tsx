import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, EmptyState, Text } from '@/components/ui';
import { Icons, IconName } from '@/constants/icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { MEAL_ICONS, MEAL_ORDER, mealLabel } from '@/components/MealSection';
import type { DashboardData } from '@/store/logStore';
import { formatPortion } from '@/lib/portion';

export type BreakdownNutrient = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g';

const NUTRIENTS: Record<BreakdownNutrient, { label: string; unit: string; color: string; icon: IconName }> = {
  calories:  { label: 'Calories', unit: 'kcal', color: Colors.calories, icon: Icons.calories },
  protein_g: { label: 'Protein',  unit: 'g',    color: Colors.protein,  icon: Icons.protein },
  carbs_g:   { label: 'Carbs',    unit: 'g',    color: Colors.carbs,    icon: Icons.carbs },
  fat_g:     { label: 'Fat',      unit: 'g',    color: Colors.fat,      icon: Icons.fat },
};

/** Up to `digits` decimals, trailing zeros dropped: 12 → "12", 12.25 → "12.3". */
const trim = (n: number, digits: number) => String(+n.toFixed(digits));

export const formatNutrient = (value: number, nutrient: BreakdownNutrient) =>
  nutrient === 'calories' ? `${Math.round(value)}` : trim(value, 1);

interface Props {
  nutrient: BreakdownNutrient | null;
  dashboard: DashboardData | null;
  onClose: () => void;
}

/**
 * Explains an aggregate figure: which meal and which food contributed how much.
 * Reads the dashboard payload only — meal subtotals and the headline total are
 * sums of these same entries server-side, so the numbers always reconcile.
 */
export default function NutrientBreakdownSheet({ nutrient, dashboard, onClose }: Props) {
  const cfg = nutrient ? NUTRIENTS[nutrient] : null;

  const { meals, total, missingCount, entryCount } = useMemo(() => {
    if (!nutrient || !dashboard) return { meals: [], total: 0, missingCount: 0, entryCount: 0 };
    let missing = 0;
    let count = 0;
    const rows = MEAL_ORDER.map((meal) => {
      const data = dashboard.meals?.[meal];
      const entries = data?.entries ?? [];
      count += entries.length;
      missing += entries.filter((e) => e[nutrient] == null).length;
      return { meal, subtotal: Number(data?.[nutrient] ?? 0), entries };
    });
    return {
      meals: rows,
      total: Number(dashboard.consumed?.[nutrient] ?? 0),
      missingCount: missing,
      entryCount: count,
    };
  }, [nutrient, dashboard]);

  return (
    <Modal visible={!!nutrient} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close breakdown" />
        <View style={styles.sheet} testID="nutrient-breakdown-sheet">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="subheading">{cfg?.label ?? ''} breakdown</Text>
              <Text variant="caption">Where today's total comes from</Text>
            </View>
            <AnimatedPressable onPress={onClose} haptic="light" accessibilityLabel="Close breakdown">
              <Ionicons name={Icons.close} size={24} color={Colors.textSecondary} />
            </AnimatedPressable>
          </View>

          {cfg && nutrient && (
            <View style={styles.totalCard}>
              <View style={[styles.totalIcon, { backgroundColor: cfg.color + '22' }]}>
                <Ionicons name={cfg.icon} size={20} color={cfg.color} />
              </View>
              <View style={styles.headerText}>
                <Text variant="caption">Total today</Text>
                <Text style={[styles.totalValue, { color: cfg.color }]} testID="breakdown-total">
                  {formatNutrient(total, nutrient)} {cfg.unit}
                </Text>
              </View>
              <Text variant="caption">
                {entryCount} food{entryCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {nutrient && cfg && entryCount === 0 ? (
            <EmptyState
              icon={cfg.icon}
              title="Nothing logged yet"
              subtitle={`Add food to a meal to see where your ${cfg.label.toLowerCase()} comes from.`}
            />
          ) : nutrient && cfg ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {missingCount > 0 && (
                <View style={styles.notice}>
                  <Ionicons name={Icons.help} size={14} color={Colors.warning} />
                  <Text variant="caption" color={Colors.textSecondary} style={styles.headerText}>
                    {missingCount} item{missingCount !== 1 ? 's have' : ' has'} no {cfg.label.toLowerCase()} data
                    and {missingCount !== 1 ? "aren't" : "isn't"} counted.
                  </Text>
                </View>
              )}

              {meals.map(({ meal, subtotal, entries }) => (
                <View key={meal} style={styles.meal} testID={`breakdown-${meal}`}>
                  <View style={styles.mealHeader}>
                    <Ionicons name={MEAL_ICONS[meal]} size={16} color={Colors.textSecondary} />
                    <Text variant="body" weight="semibold" color={Colors.textPrimary} style={styles.headerText}>
                      {mealLabel(meal)}
                    </Text>
                    <Text variant="body" weight="bold" color={entries.length ? Colors.textPrimary : Colors.textMuted}>
                      {formatNutrient(subtotal, nutrient)} {cfg.unit}
                    </Text>
                  </View>

                  {entries.length === 0 ? (
                    <Text variant="caption" style={styles.nothing}>
                      Nothing logged
                    </Text>
                  ) : (
                    entries.map((entry) => {
                      const value = entry[nutrient];
                      const share = value != null && total > 0 ? Math.round((value / total) * 100) : null;
                      return (
                        <View key={entry.id} style={styles.entry}>
                          <View style={[styles.dot, { backgroundColor: cfg.color }]} />
                          <View style={styles.headerText}>
                            <Text variant="body" color={Colors.textPrimary} numberOfLines={2}>
                              {entry.name}
                            </Text>
                            <Text variant="caption">{formatPortion(entry.quantity, entry.serving_unit)}</Text>
                          </View>
                          <View style={styles.entryValue}>
                            <Text variant="body" weight="semibold" color={value == null ? Colors.textMuted : Colors.textPrimary}>
                              {value == null ? 'No data' : `${formatNutrient(value, nutrient)} ${cfg.unit}`}
                            </Text>
                            {share != null && <Text variant="caption">{share}%</Text>}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  totalIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalValue: {
    fontSize: Typography.size.xxl,
    lineHeight: Typography.lineHeight.xxl,
    fontWeight: Typography.weight.bold,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: Spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  meal: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nothing: {
    marginLeft: Spacing.lg,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  entryValue: {
    alignItems: 'flex-end',
  },
});
