import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Text } from '@/components/ui';
import { Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';

// ── Types ──────────────────────────────────────────────────────────────────
export type GoalType = 'lose_weight' | 'maintain' | 'gain_muscle';

const GOAL_OPTIONS: { key: GoalType; icon: IconName; label: string; desc: string }[] = [
  { key: 'lose_weight', icon: Icons.calories, label: 'Lose Weight', desc: '−15% calorie deficit' },
  { key: 'maintain', icon: Icons.weight, label: 'Maintain', desc: 'Maintain current weight' },
  { key: 'gain_muscle', icon: Icons.protein, label: 'Gain Muscle', desc: '+10% calorie surplus' },
];

interface Props {
  goalType: GoalType;
  onGoalTypeChange: (g: GoalType) => void;
  calories: string;
  onCaloriesChange: (v: string) => void;
  protein: string;
  onProteinChange: (v: string) => void;
  carbs: string;
  onCarbsChange: (v: string) => void;
  fat: string;
  onFatChange: (v: string) => void;
  calcLoading: boolean;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
}

/** Step 2 — goal type + calculated calorie/macro targets. */
export function StepGoals({
  goalType,
  onGoalTypeChange,
  calories,
  onCaloriesChange,
  protein,
  onProteinChange,
  carbs,
  onCarbsChange,
  fat,
  onFatChange,
  calcLoading,
  saving,
  onBack,
  onFinish,
}: Props) {
  const selectedGoalOption = GOAL_OPTIONS.find((g) => g.key === goalType);

  return (
    <View>
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(250)}>
        <Text variant="hero" style={styles.title}>
          Your Daily Goals
        </Text>
        <Text variant="body" style={styles.subtitle}>
          We've calculated your targets based on your profile. Adjust if you'd like.
        </Text>
      </Animated.View>

      {/* ── Goal type ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(50)}>
        <Text variant="label" style={styles.sectionLabel}>
          What's your goal?
        </Text>
        <View style={styles.chipWrap}>
          {GOAL_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              selected={goalType === opt.key}
              onPress={() => {
                if (!calcLoading) onGoalTypeChange(opt.key);
              }}
              testID={`onboarding-goal-${opt.key}`}
            />
          ))}
        </View>
        {selectedGoalOption && (
          <Text variant="caption" style={styles.goalDesc}>
            {selectedGoalOption.desc}
          </Text>
        )}
      </Animated.View>

      {calcLoading && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.calcRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text variant="label" color={Colors.textMuted}>
            Calculating your targets…
          </Text>
        </Animated.View>
      )}

      {/* ── Macro targets ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(100)}>
        <Text variant="label" style={styles.sectionLabel}>
          Daily Targets
        </Text>
        <Card padded={false} style={styles.macroCard}>
          <MacroField
            icon={Icons.calories}
            color={Colors.calories}
            label="Calories"
            unit="kcal"
            value={calories}
            onChange={onCaloriesChange}
          />
          <View style={styles.divider} />
          <MacroField
            icon={Icons.protein}
            color={Colors.protein}
            label="Protein"
            unit="g"
            value={protein}
            onChange={onProteinChange}
          />
          <View style={styles.divider} />
          <MacroField
            icon={Icons.carbs}
            color={Colors.carbs}
            label="Carbs"
            unit="g"
            value={carbs}
            onChange={onCarbsChange}
          />
          <View style={styles.divider} />
          <MacroField
            icon={Icons.fat}
            color={Colors.fat}
            label="Fat"
            unit="g"
            value={fat}
            onChange={onFatChange}
          />
        </Card>

        <Text variant="caption" style={styles.hint}>
          These are calculated using the Mifflin-St Jeor BMR formula. You can always edit them
          later.
        </Text>
      </Animated.View>

      {/* ── Actions ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(150)} style={styles.buttonRow}>
        <Button
          title="Back"
          onPress={onBack}
          variant="secondary"
          size="lg"
          icon={Icons.back}
          testID="onboarding-back"
        />
        <Button
          title="Let's Go!"
          onPress={onFinish}
          loading={saving}
          size="lg"
          haptic="success"
          style={styles.finishBtn}
          testID="onboarding-finish"
        />
      </Animated.View>
    </View>
  );
}

// ── MacroField sub-component ───────────────────────────────────────────────
function MacroField({
  icon,
  color,
  label,
  unit,
  value,
  onChange,
}: {
  icon: IconName;
  color: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.macroRow}>
      <View style={[styles.macroIconWrap, { backgroundColor: `${color}26` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text variant="body" color={Colors.textPrimary} weight="semibold">
        {label}
      </Text>
      <View style={styles.flex} />
      <Animated.View
        style={[
          styles.macroInputWrap,
          {
            borderColor: focused ? color : Colors.borderStrong,
            transitionProperty: 'borderColor',
            transitionDuration: Motion.duration.fast,
          },
        ]}
      >
        <TextInput
          style={styles.macroInput}
          keyboardType="number-pad"
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="—"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
        />
      </Animated.View>
      <Text variant="label" color={Colors.textMuted} style={styles.macroUnit}>
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing.sm },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  goalDesc: { marginTop: Spacing.sm },

  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  macroCard: { overflow: 'hidden' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  macroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroInputWrap: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  macroInput: {
    minWidth: 80,
    textAlign: 'right',
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  macroUnit: { minWidth: 30 },

  hint: { marginTop: Spacing.md, marginBottom: Spacing.sm },

  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  finishBtn: { flex: 1 },
});
