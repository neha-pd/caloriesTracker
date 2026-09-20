import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';
import { AnimatedPressable, Card, Text } from '@/components/ui';
import type { DashboardMeal, MealType } from '@/store/logStore';

/** Display order for meals everywhere they are listed. */
export const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

export const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: Icons.meal.breakfast,
  lunch:     Icons.meal.lunch,
  dinner:    Icons.meal.dinner,
  snack:     Icons.meal.snack,
};

export const mealLabel = (meal: string) => meal.charAt(0).toUpperCase() + meal.slice(1);

interface Props {
  meal:  MealType;
  data?: DashboardMeal;
  onAdd: () => void;
}

export default function MealSection({ meal, data, onAdd }: Props) {
  const hasEntries = (data?.entry_count ?? 0) > 0;

  return (
    <Animated.View layout={LinearTransition.duration(250)}>
      <Card
        style={styles.card}
        onPress={onAdd}
        testID={`meal-${meal}`}
      >
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={MEAL_ICONS[meal]} size={20} color={Colors.textSecondary} />
          </View>
          <View style={styles.info}>
            <Text variant="subheading" numberOfLines={1}>
              {mealLabel(meal)}
            </Text>
            {/* Same three lines whether or not food is logged, so every meal
                card has identical dimensions. */}
            <Text variant="label" numberOfLines={1} style={styles.sub}>
              {hasEntries
                ? `${Math.round(data!.calories)} kcal · ${data!.entry_count} item${data!.entry_count !== 1 ? 's' : ''}`
                : 'No items logged'}
            </Text>
            <Text variant="caption" color={hasEntries ? Colors.textSecondary : Colors.textMuted} numberOfLines={1} style={styles.items}>
              {hasEntries && data!.item_names?.length ? data!.item_names.join(' · ') : 'Tap to add food'}
            </Text>
          </View>
          <AnimatedPressable
            onPress={onAdd}
            haptic="light"
            style={styles.addBtn}
            testID={`meal-${meal}-add`}
            accessibilityLabel={`Add food to ${meal}`}
          >
            <Ionicons name={Icons.add} size={18} color={Colors.textOnPrimary} />
          </AnimatedPressable>
        </View>

        <View style={styles.macroBar}>
          {[
            { label: 'P', val: data?.protein_g ?? 0, color: Colors.protein },
            { label: 'C', val: data?.carbs_g ?? 0,   color: Colors.carbs   },
            { label: 'F', val: data?.fat_g ?? 0,     color: Colors.fat     },
          ].map(({ label, val, color }) => (
            <View key={label} style={styles.macroChip}>
              <View style={[styles.macroColorDot, { backgroundColor: hasEntries ? color : Colors.borderStrong }]} />
              <Text variant="caption" color={hasEntries ? Colors.textSecondary : Colors.textMuted}>
                {label} {Math.round(val)}g
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  sub: {
    marginTop: 2,
  },
  items: {
    marginTop: 3,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
