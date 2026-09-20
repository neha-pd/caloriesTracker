import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable, Button, Card, Screen, Text } from '@/components/ui';
import { Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

/* ─── Types ───────────────────────────────────────────────── */
type GoalType = 'lose_weight' | 'maintain' | 'gain_muscle';

interface MicroNutrients {
  fiber_g:      number;
  sodium_mg:    number;
  calcium_mg:   number;
  iron_mg:      number;
  vitaminC_mg:  number;
  vitaminD_iu:  number;
  potassium_mg: number;
  magnesium_mg: number;
}

interface Calculated extends MicroNutrients {
  tdee:         number;
  calorie_goal: number;
  protein_g:    number;
  carbs_g:      number;
  fat_g:        number;
}

/* ─── Constants ───────────────────────────────────────────── */
const GOAL_OPTIONS: { key: GoalType; label: string; icon: IconName; desc: string }[] = [
  { key: 'lose_weight', label: 'Lose Weight', icon: Icons.trendingDown, desc: '−15% calorie deficit' },
  { key: 'maintain',    label: 'Maintain',    icon: Icons.weight,       desc: 'Maintain current weight' },
  { key: 'gain_muscle', label: 'Gain Muscle', icon: Icons.protein,      desc: '+10% calorie surplus' },
];

const MICRO_LABELS: { key: keyof MicroNutrients; label: string; unit: string; color: string }[] = [
  { key: 'fiber_g',      label: 'Fiber',       unit: 'g',   color: '#6bcb77' },
  { key: 'sodium_mg',    label: 'Sodium',      unit: 'mg',  color: '#f3727f' },
  { key: 'calcium_mg',   label: 'Calcium',     unit: 'mg',  color: '#b8d4f8' },
  { key: 'iron_mg',      label: 'Iron',        unit: 'mg',  color: '#e07b54' },
  { key: 'vitaminC_mg',  label: 'Vitamin C',   unit: 'mg',  color: '#ffa42b' },
  { key: 'vitaminD_iu',  label: 'Vitamin D',   unit: 'IU',  color: '#ffe566' },
  { key: 'potassium_mg', label: 'Potassium',   unit: 'mg',  color: '#a78bfa' },
  { key: 'magnesium_mg', label: 'Magnesium',   unit: 'mg',  color: '#34d399' },
];

/* ─── Component ───────────────────────────────────────────── */
export default function EditGoalsScreen() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const user         = useAuthStore((s) => s.user);
  const updateUser   = useAuthStore((s) => s.updateUser);

  // Manual fields
  const [calories,   setCalories]   = useState(String(user?.calorie_goal   ?? 2000));
  const [protein,    setProtein]    = useState(String(user?.protein_goal_g  ?? 150));
  const [carbs,      setCarbs]      = useState(String(user?.carbs_goal_g    ?? 200));
  const [fat,        setFat]        = useState(String(user?.fat_goal_g      ?? 65));
  const [goalType,   setGoalType]   = useState<GoalType>((user?.goal_type as GoalType) ?? 'maintain');
  const [focused,    setFocused]    = useState<string | null>(null);

  // Auto-calc state
  const [autoCalc,   setAutoCalc]   = useState(false);
  const [calculated, setCalculated] = useState<Calculated | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);

  // Section entrances: staggered FadeInDown, builders memoized so re-renders
  // (every keystroke) never re-instantiate them.
  const entering = useMemo(
    () => Array.from({ length: 6 }, (_, i) => FadeInDown.duration(250).delay(i * 50)),
    []
  );
  const microEntering = useMemo(() => FadeInDown.duration(250), []);
  const microExiting  = useMemo(() => FadeOut.duration(150), []);

  /* ── Auto-calculate from server ───────────────────────────── */
  const handleAutoCalc = useCallback(async () => {
    if (!user?.height_cm || !user?.weight_kg || !user?.age) {
      // Redirect to Profile tab so user can fill in physical stats
      router.push('/(tabs)/profile');
      return;
    }
    setCalcLoading(true);
    try {
      const { data } = await api.get<Calculated>('/api/users/me/goals/calculate');
      setCalculated(data);
      setCalories(String(data.calorie_goal));
      setProtein(String(data.protein_g));
      setCarbs(String(data.carbs_g));
      setFat(String(data.fat_g));
      setAutoCalc(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Could not calculate goals.');
    } finally {
      setCalcLoading(false);
    }
  }, [user, goalType]);

  /* ── Switch goal type + recalc if in auto mode ────────────── */
  const handleGoalType = async (g: GoalType) => {
    setGoalType(g);
    if (autoCalc && user?.height_cm && user?.weight_kg && user?.age) {
      setCalcLoading(true);
      try {
        // B7 fix: pass goal_type as query param — the backend calculate endpoint
        // now accepts it directly so we don’t need to PATCH the DB first
        const { data } = await api.get<Calculated>(`/api/users/me/goals/calculate?goal_type=${g}`);
        setCalculated(data);
        setCalories(String(data.calorie_goal));
        setProtein(String(data.protein_g));
        setCarbs(String(data.carbs_g));
        setFat(String(data.fat_g));
      } catch { /* ignore — keep previous values */ } finally {
        setCalcLoading(false);
      }
    }
  };

  /* ── Manually change calories → recalc macros in auto mode ── */
  const handleCaloriesChange = (v: string) => {
    setCalories(v);
    if (autoCalc) {
      const cal = parseInt(v, 10);
      if (!isNaN(cal) && cal > 0) {
        setProtein(String(Math.round((cal * 0.25) / 4)));
        setCarbs(String(Math.round((cal * 0.45) / 4)));
        setFat(String(Math.round((cal * 0.30) / 9)));
      }
    }
  };

  /* ── Save ─────────────────────────────────────────────────── */
  const handleSave = async () => {
    const cal = parseInt(calories, 10);
    const pro = parseInt(protein, 10);
    const car = parseInt(carbs, 10);
    const fa  = parseInt(fat, 10);

    if (isNaN(cal) || cal < 500) {
      return Alert.alert('Invalid', 'Calorie goal must be at least 500 kcal.');
    }

    setSaving(true);
    try {
      const { data } = await api.patch('/api/users/me/goals', {
        goal_type:      goalType,
        calorie_goal:   cal,
        protein_goal_g: isNaN(pro) ? undefined : pro,
        carbs_goal_g:   isNaN(car) ? undefined : car,
        fat_goal_g:     isNaN(fa)  ? undefined : fa,
      });
      updateUser({
        goal_type:      data.goals.goal_type,
        calorie_goal:   data.goals.calorie_goal,
        protein_goal_g: data.goals.protein_goal_g ?? pro,
        carbs_goal_g:   data.goals.carbs_goal_g   ?? car,
        fat_goal_g:     data.goals.fat_goal_g     ?? fa,
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'today'] });
      // Success haptic fired once, at the moment the save resolves — paired
      // with the visual feedback of navigating back.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to save goals.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  const macroCalories = () => {
    const p = parseInt(protein, 10) || 0;
    const c = parseInt(carbs,   10) || 0;
    const f = parseInt(fat,     10) || 0;
    return p * 4 + c * 4 + f * 9;
  };

  const totalMacroCal = macroCalories();
  const calGoal       = parseInt(calories, 10) || 0;
  const macroBalance  = calGoal - totalMacroCal;
  const balanceColor  = Math.abs(macroBalance) > 50 ? Colors.warning : Colors.primary;
  const hasProfile    = !!(user?.height_cm && user?.weight_kg && user?.age);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <Screen scroll keyboardAvoiding>
      {/* ── Header ── */}
      <Animated.View entering={entering[0]} style={styles.headerRow}>
        <AnimatedPressable onPress={() => router.back()} haptic="light" style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name={Icons.back} size={24} color={Colors.textPrimary} />
        </AnimatedPressable>
        <Text variant="heading">Edit Goals</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* ── Goal Type Selector ── */}
      <Animated.View entering={entering[1]}>
        <Text variant="label" style={styles.sectionLabel}>Your Goal</Text>
        <View style={styles.goalRow}>
          {GOAL_OPTIONS.map((opt) => {
            const selected = goalType === opt.key;
            return (
              <View key={opt.key} style={styles.goalCol}>
                <AnimatedPressable onPress={() => handleGoalType(opt.key)} haptic="selection">
                  <Animated.View
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: selected ? Colors.primaryMuted : Colors.bgCard,
                        borderColor: selected ? Colors.primary : Colors.border,
                        transitionProperty: ['backgroundColor', 'borderColor'],
                        transitionDuration: Motion.duration.fast,
                      },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={20} color={selected ? Colors.primary : Colors.textSecondary} />
                    <Text variant="label" weight="bold" center color={selected ? Colors.primary : Colors.textSecondary}>
                      {opt.label}
                    </Text>
                    <Text variant="caption" center style={styles.goalChipDesc}>
                      {opt.desc}
                    </Text>
                  </Animated.View>
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* ── Auto-Calculate Banner ── */}
      <Animated.View entering={entering[2]}>
        <Card style={styles.autoBanner}>
          <View style={styles.autoBannerBody}>
            <View style={styles.autoBannerTitleRow}>
              <Ionicons name={Icons.calculator} size={16} color={Colors.primary} />
              <Text variant="body" weight="bold" color={Colors.textPrimary}>
                Auto-Calculate from Profile
              </Text>
            </View>
            {hasProfile ? (
              <Text variant="caption" style={styles.autoBannerSub}>
                Uses Mifflin-St Jeor BMR + AMDR macro split
                {` (${user!.weight_kg}kg · ${user!.height_cm}cm · age ${user!.age})`}
              </Text>
            ) : (
              <AnimatedPressable onPress={() => router.push('/(tabs)/profile')}>
                <Text variant="caption" style={styles.autoBannerSub}>
                  Profile incomplete —{' '}
                  <Text variant="caption" color={Colors.primary} weight="bold">
                    tap to complete your profile
                  </Text>
                </Text>
              </AnimatedPressable>
            )}
          </View>
          <Button
            title="Calculate"
            onPress={handleAutoCalc}
            size="sm"
            loading={calcLoading}
            style={styles.calcBtn}
          />
        </Card>
      </Animated.View>

      {/* ── Calorie Goal ── */}
      <Animated.View entering={entering[3]}>
        <Text variant="label" style={styles.sectionLabel}>Daily Calorie Intake</Text>
        <Card padded={false} style={styles.calorieCard}>
          <View style={styles.calorieInputRow}>
            <Animated.View
              style={[
                styles.calorieInputWrap,
                {
                  borderColor: focused === 'calories' ? Colors.primary : Colors.borderStrong,
                  transitionProperty: 'borderColor',
                  transitionDuration: Motion.duration.fast,
                },
              ]}
            >
              <TextInput
                style={styles.calorieInput}
                value={calories}
                onChangeText={handleCaloriesChange}
                keyboardType="number-pad"
                onFocus={() => setFocused('calories')}
                onBlur={() => setFocused(null)}
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.primary}
              />
            </Animated.View>
            <Text variant="body" weight="semibold">kcal / day</Text>
          </View>
          {/* Macro calorie balance indicator */}
          <View style={styles.balanceRow}>
            <Text variant="label" weight="regular" color={Colors.textMuted}>Macros total:</Text>
            <View style={styles.balanceVal}>
              <Text variant="label" weight="bold" color={balanceColor}>
                {totalMacroCal} kcal
                {Math.abs(macroBalance) > 5
                  ? (macroBalance > 0 ? `  (${macroBalance} unaccounted)` : `  (${-macroBalance} over)`)
                  : ''}
              </Text>
              {Math.abs(macroBalance) <= 5 ? (
                <Ionicons name={Icons.check} size={14} color={balanceColor} />
              ) : null}
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Macros ── */}
      <Animated.View entering={entering[4]}>
        <Text variant="label" style={styles.sectionLabel}>Macronutrients</Text>
        <Card padded={false} style={styles.macroCard}>
          <MacroField
            icon={Icons.protein} label="Protein" unit="g" color={Colors.protein}
            value={protein} onChangeText={setProtein}
            focused={focused === 'protein'} onFocus={() => setFocused('protein')} onBlur={() => setFocused(null)}
            note={`${Math.round((parseInt(protein, 10) || 0) * 4)} kcal`}
          />
          <View style={styles.macroDivider} />
          <MacroField
            icon={Icons.carbs} label="Carbs" unit="g" color={Colors.carbs}
            value={carbs} onChangeText={setCarbs}
            focused={focused === 'carbs'} onFocus={() => setFocused('carbs')} onBlur={() => setFocused(null)}
            note={`${Math.round((parseInt(carbs, 10) || 0) * 4)} kcal`}
          />
          <View style={styles.macroDivider} />
          <MacroField
            icon={Icons.fat} label="Fat" unit="g" color={Colors.fat}
            value={fat} onChangeText={setFat}
            focused={focused === 'fat'} onFocus={() => setFocused('fat')} onBlur={() => setFocused(null)}
            note={`${Math.round((parseInt(fat, 10) || 0) * 9)} kcal`}
          />
        </Card>
      </Animated.View>

      {/* ── Micro-nutrients panel (shown only after auto-calc) ── */}
      {calculated && (
        <Animated.View entering={microEntering} exiting={microExiting}>
          <Text variant="label" style={styles.sectionLabel}>Recommended Micronutrients</Text>
          <Card>
            <Text variant="caption" style={styles.microNote}>
              Based on DRI guidelines for your age, gender & goal. These are daily targets to aim for.
            </Text>
            <View style={styles.microGrid}>
              {MICRO_LABELS.map((m) => (
                <View key={m.key} style={styles.microItem}>
                  <View style={[styles.microDot, { backgroundColor: m.color }]} />
                  <Text variant="label" weight="regular" style={styles.microLabel}>{m.label}</Text>
                  <Text variant="label" weight="bold" color={m.color}>
                    {calculated[m.key]}{m.unit}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>
      )}

      {/* ── Save Button ── */}
      <Animated.View entering={entering[5]}>
        <Button
          title="Save Goals"
          onPress={handleSave}
          loading={saving}
          size="lg"
          fullWidth
          haptic="medium"
          testID="save-goals"
          style={styles.saveBtn}
        />
      </Animated.View>
    </Screen>
  );
}

/* ─── MacroField sub-component ────────────────────────────── */
interface MacroFieldProps {
  icon: IconName; label: string; unit: string; color: string;
  value: string; onChangeText: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
  note: string;
}
function MacroField({ icon, label, unit, color, value, onChangeText, focused, onFocus, onBlur, note }: MacroFieldProps) {
  return (
    <View style={macroStyles.row}>
      <View style={[macroStyles.iconBg, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text variant="body" weight="semibold" color={Colors.textPrimary} style={macroStyles.label}>{label}</Text>
      <View style={macroStyles.spacer} />
      <Animated.View
        style={[
          macroStyles.inputWrap,
          {
            borderColor: focused ? color : Colors.borderStrong,
            transitionProperty: 'borderColor',
            transitionDuration: Motion.duration.fast,
          },
        ]}
      >
        <TextInput
          style={macroStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          onFocus={onFocus}
          onBlur={onBlur}
          placeholderTextColor={Colors.textMuted}
          selectionColor={color}
        />
      </Animated.View>
      <Text variant="label" weight="regular" style={macroStyles.unit}>{unit}</Text>
      <Text variant="label" weight="regular" color={Colors.textMuted} style={macroStyles.note}>{note}</Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md, marginBottom: Spacing.lg,
  },
  backBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerSpacer: { width: 40 },

  sectionLabel: {
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: Spacing.sm, marginTop: Spacing.lg,
  },

  // Goal type chips
  goalRow: { flexDirection: 'row', gap: Spacing.sm },
  goalCol: { flex: 1 },
  goalChip: {
    borderRadius: Radius.lg, padding: Spacing.sm,
    alignItems: 'center', gap: 2, borderWidth: 1.5,
  },
  goalChipDesc: { lineHeight: 12, fontSize: 9 },

  // Auto-calc banner
  autoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgElevated, marginTop: Spacing.lg,
  },
  autoBannerBody:     { flex: 1, gap: 2 },
  autoBannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  autoBannerSub:      { lineHeight: 16 },
  calcBtn:            { minWidth: 90 },

  // Calorie card
  calorieCard:     { padding: Spacing.lg },
  calorieInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  calorieInputWrap: {
    flex: 1, backgroundColor: Colors.bgInput,
    borderRadius: Radius.md, borderWidth: 1.5,
  },
  calorieInput: {
    fontSize: 36, fontWeight: Typography.weight.bold, color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: Spacing.sm,
  },
  balanceVal: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  // Macro card
  macroCard:    { overflow: 'hidden' },
  macroDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  // Micro card
  microNote: { marginBottom: Spacing.md, lineHeight: 16 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  microItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '48%', paddingVertical: 6,
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md, paddingHorizontal: Spacing.sm,
  },
  microDot:   { width: 8, height: 8, borderRadius: 4 },
  microLabel: { flex: 1, color: Colors.textSecondary },

  // Save button
  saveBtn: { marginTop: Spacing.xl },
});

const macroStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  iconBg: { width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  label:  { minWidth: 56 },
  spacer: { flex: 1 },
  inputWrap: {
    width: 72, backgroundColor: Colors.bgInput,
    borderRadius: Radius.md, borderWidth: 1.5,
  },
  input: {
    textAlign: 'center', fontSize: Typography.size.lg, fontWeight: Typography.weight.bold,
    color: Colors.textPrimary, paddingVertical: 8, paddingHorizontal: 8,
  },
  unit: { minWidth: 16 },
  note: { textAlign: 'right', minWidth: 56 },
});
