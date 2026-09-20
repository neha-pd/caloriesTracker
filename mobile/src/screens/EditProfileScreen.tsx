import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AnimatedPressable, Button, Card, Screen, Text } from '@/components/ui';
import { Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

/* ─── Types ───────────────────────────────────────────────── */
type Gender        = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';

const GENDER_OPTIONS: { key: Gender; label: string; icon: IconName }[] = [
  { key: 'male',              label: 'Male',       icon: Icons.male },
  { key: 'female',            label: 'Female',     icon: Icons.female },
  { key: 'other',             label: 'Other',      icon: Icons.gender },
  { key: 'prefer_not_to_say', label: 'Prefer not', icon: Icons.help },
];

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; desc: string; icon: IconName }[] = [
  { key: 'sedentary',         label: 'Sedentary',      desc: 'Little or no exercise',    icon: Icons.activity.sedentary },
  { key: 'lightly_active',    label: 'Light',          desc: '1–3 days/week',            icon: Icons.activity.light },
  { key: 'moderately_active', label: 'Moderate',       desc: '3–5 days/week',            icon: Icons.activity.moderate },
  { key: 'very_active',       label: 'Very Active',    desc: '6–7 days/week',            icon: Icons.activity.active },
  { key: 'extra_active',      label: 'Extra Active',   desc: 'Physical job or 2×/day',   icon: Icons.activity.veryActive },
];

const BMI_CATEGORIES = [
  { max: 18.5,     label: 'Underweight', color: Colors.warning },
  { max: 25,       label: 'Normal',      color: Colors.primary },
  { max: 30,       label: 'Overweight',  color: Colors.warning },
  { max: Infinity, label: 'Obese',       color: Colors.danger },
];

/* ─── Component ───────────────────────────────────────────── */
export default function EditProfileScreen() {
  const router     = useRouter();
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [name,     setName]     = useState(user?.display_name ?? '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    user?.age ? (() => { const d = new Date(); d.setFullYear(d.getFullYear() - user.age); return d; })() : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [height,   setHeight]   = useState(user?.height_cm ? String(user.height_cm) : '');
  const [weight,   setWeight]   = useState(user?.weight_kg ? String(user.weight_kg) : '');
  const [gender,   setGender]   = useState<Gender | null>((user?.gender as Gender) ?? null);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [activity, setActivity] = useState<ActivityLevel | null>((user?.activity_level as ActivityLevel) ?? null);
  const [focused,  setFocused]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  // Section entrances: staggered FadeInDown, builders memoized so re-renders
  // (every keystroke) never re-instantiate them.
  const entering = useMemo(
    () => Array.from({ length: 7 }, (_, i) => FadeInDown.duration(250).delay(i * 45)),
    []
  );
  const bmiEntering = useMemo(() => FadeInDown.duration(250), []);
  const bmiExiting  = useMemo(() => FadeOut.duration(150), []);

  /* ── Calculate age from birthdate ──────────────────────── */
  const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const age = birthDate ? calculateAge(birthDate) : null;
  const selectedGenderOption = GENDER_OPTIONS.find(g => g.key === gender);

  /* ── Validation ────────────────────────────────────────── */
  const validate = () => {
    const heightN = height ? parseFloat(height)   : null;
    const weightN = weight ? parseFloat(weight)   : null;

    if (age !== null && (age < 10 || age > 120)) {
      Alert.alert('Invalid', 'Age must be between 10 and 120.'); return false;
    }
    if (heightN !== null && (isNaN(heightN) || heightN < 50 || heightN > 300)) {
      Alert.alert('Invalid', 'Height must be between 50 and 300 cm.'); return false;
    }
    if (weightN !== null && (isNaN(weightN) || weightN < 10 || weightN > 500)) {
      Alert.alert('Invalid', 'Weight must be between 10 and 500 kg.'); return false;
    }
    return true;
  };

  /* ── Save ──────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!validate()) return;

    const payload: Record<string, any> = {};
    if (name.trim())   payload.display_name  = name.trim();
    if (age !== null)  payload.age           = age;
    if (height)        payload.height_cm     = parseFloat(height);
    if (weight)        payload.weight_kg     = parseFloat(weight);
    if (gender)        payload.gender        = gender;
    if (activity)      payload.activity_level = activity;

    setSaving(true);
    try {
      const { data } = await api.patch('/api/users/me', payload);
      updateUser({
        display_name:   data.user.display_name,
        age:            data.user.age,
        height_cm:      data.user.height_cm,
        weight_kg:      data.user.weight_kg,
        gender:         data.user.gender,
        activity_level: data.user.activity_level,
      });

      // Auto-recalculate goals based on new physical profile
      const hasPhysicalData = data.user.age && data.user.height_cm && data.user.weight_kg;
      if (hasPhysicalData) {
        try {
          const goalType = data.user.goal_type || 'maintain';
          const { data: calc } = await api.get(`/api/users/me/goals/calculate?goal_type=${goalType}`);
          // Save recalculated goals to the database
          const { data: savedGoals } = await api.patch('/api/users/me/goals', {
            goal_type: goalType,
            calorie_goal: calc.calorie_goal,
            protein_goal_g: calc.protein_g,
            carbs_goal_g: calc.carbs_g,
            fat_goal_g: calc.fat_g,
          });
          // Update auth store with new goals
          updateUser({
            goal_type:      savedGoals.goals.goal_type,
            calorie_goal:   savedGoals.goals.calorie_goal,
            protein_goal_g: savedGoals.goals.protein_goal_g,
            carbs_goal_g:   savedGoals.goals.carbs_goal_g,
            fat_goal_g:     savedGoals.goals.fat_goal_g,
          });
        } catch {
          // Goals recalculation failed — profile is still saved, goals stay as they were
        }
      }

      // Success haptic fired once, at the moment the save resolves — paired
      // with the visual feedback of navigating back.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  /* ── BMI ───────────────────────────────────────────────── */
  const bmiInfo = (() => {
    if (!height || !weight) return null;
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (isNaN(h) || isNaN(w) || h <= 0) return null;
    const bmi = (w / (h * h)).toFixed(1);
    const cat = BMI_CATEGORIES.find((c) => parseFloat(bmi) < c.max)!;
    return { bmi, ...cat };
  })();

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <Screen scroll keyboardAvoiding>
      {/* ── Header ── */}
      <Animated.View entering={entering[0]} style={styles.headerRow}>
        <AnimatedPressable onPress={() => router.back()} haptic="light" style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name={Icons.back} size={24} color={Colors.textPrimary} />
        </AnimatedPressable>
        <Text variant="heading">Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* ── Avatar Initials ── */}
      <Animated.View entering={entering[1]} style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text variant="title" weight="heavy" color={Colors.textOnPrimary}>
            {(name || user?.display_name || user?.email || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text variant="label" weight="regular" color={Colors.textMuted}>Personal details</Text>
      </Animated.View>

      {/* ── Basic Info ── */}
      <Animated.View entering={entering[2]}>
        <Text variant="label" style={styles.sectionLabel}>Basic Info</Text>
        <Card padded={false} style={styles.card}>
          <Field
            icon={Icons.person} label="Display Name" placeholder="Your name"
            value={name} onChangeText={setName}
            keyboardType="default"
            focused={focused === 'name'} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
          />
          <View style={styles.divider} />

          {/* ── Date of Birth ── */}
          <AnimatedPressable onPress={() => setShowDatePicker(true)} haptic="light" style={fieldStyles.row}>
            <Ionicons name={Icons.calendar} size={18} color={Colors.textSecondary} style={fieldStyles.icon} />
            <Text variant="body" weight="semibold" color={Colors.textPrimary}>Date of Birth</Text>
            <View style={fieldStyles.spacer} />
            <View style={[fieldStyles.valueBox, styles.dobValue]}>
              <Text variant="body" weight="bold" color={birthDate ? Colors.textPrimary : Colors.textMuted}>
                {birthDate ? birthDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select'}
              </Text>
            </View>
            {age !== null && <Text variant="label" weight="regular" color={Colors.textMuted} style={fieldStyles.suffix}>{age} yrs</Text>}
          </AnimatedPressable>

          {showDatePicker && (
            Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
                  <View style={styles.sheet}>
                    <View style={styles.sheetHeader}>
                      <Text variant="subheading">Select Date of Birth</Text>
                      <AnimatedPressable onPress={() => setShowDatePicker(false)} haptic="light">
                        <Text variant="body" weight="bold" color={Colors.primary}>Done</Text>
                      </AnimatedPressable>
                    </View>
                    <DateTimePicker
                      value={birthDate ?? new Date(1995, 0, 1)}
                      mode="date"
                      display="spinner"
                      maximumDate={new Date()}
                      minimumDate={new Date(1900, 0, 1)}
                      onChange={(_, date) => { if (date) setBirthDate(date); }}
                      textColor={Colors.textPrimary}
                    />
                  </View>
                </Pressable>
              </Modal>
            ) : (
              <DateTimePicker
                value={birthDate ?? new Date(1995, 0, 1)}
                mode="date"
                display="default"
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                onChange={(_, date) => { setShowDatePicker(false); if (date) setBirthDate(date); }}
              />
            )
          )}
        </Card>
      </Animated.View>

      {/* ── Gender Dropdown ── */}
      <Animated.View entering={entering[3]}>
        <Text variant="label" style={styles.sectionLabel}>Gender</Text>
        <AnimatedPressable onPress={() => setShowGenderPicker(true)} haptic="light" style={styles.dropdownBtn}>
          {selectedGenderOption ? (
            <View style={styles.dropdownValue}>
              <Ionicons name={selectedGenderOption.icon} size={18} color={Colors.primary} />
              <Text variant="body" weight="semibold" color={Colors.textPrimary}>{selectedGenderOption.label}</Text>
            </View>
          ) : (
            <Text variant="body" color={Colors.textMuted}>Select gender</Text>
          )}
          <Ionicons name={Icons.chevronDown} size={16} color={Colors.textMuted} />
        </AnimatedPressable>
      </Animated.View>

      {/* Gender Picker Modal */}
      <Modal visible={showGenderPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
          <View style={[styles.sheet, styles.pickerSheet]}>
            <Text variant="subheading" center style={styles.pickerTitle}>Select Gender</Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const selected = gender === item.key;
                return (
                  <AnimatedPressable
                    onPress={() => { setGender(item.key); setShowGenderPicker(false); }}
                    haptic="selection"
                    style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                  >
                    <Ionicons name={item.icon} size={20} color={selected ? Colors.primary : Colors.textSecondary} />
                    <Text
                      variant="body"
                      weight="semibold"
                      color={selected ? Colors.primary : Colors.textPrimary}
                      style={styles.pickerOptionText}
                    >
                      {item.label}
                    </Text>
                    {selected && <Ionicons name={Icons.check} size={20} color={Colors.primary} />}
                  </AnimatedPressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* ── Body Measurements ── */}
      <Animated.View entering={entering[4]}>
        <Text variant="label" style={styles.sectionLabel}>Body Measurements</Text>
        <Card padded={false} style={styles.card}>
          <Field
            icon={Icons.height} label="Height" placeholder="e.g. 165" suffix="cm"
            value={height} onChangeText={setHeight}
            keyboardType="decimal-pad"
            focused={focused === 'height'} onFocus={() => setFocused('height')} onBlur={() => setFocused(null)}
          />
          <View style={styles.divider} />
          <Field
            icon={Icons.weight} label="Weight" placeholder="e.g. 65.5" suffix="kg"
            value={weight} onChangeText={setWeight}
            keyboardType="decimal-pad"
            focused={focused === 'weight'} onFocus={() => setFocused('weight')} onBlur={() => setFocused(null)}
          />
        </Card>
      </Animated.View>

      {/* ── BMI hint ── */}
      {bmiInfo && (
        <Animated.View entering={bmiEntering} exiting={bmiExiting} style={styles.bmiChip}>
          <View style={[styles.bmiDot, { backgroundColor: bmiInfo.color }]} />
          <Text variant="label">
            BMI {bmiInfo.bmi} — <Text variant="label" color={bmiInfo.color}>{bmiInfo.label}</Text>
          </Text>
        </Animated.View>
      )}

      {/* ── Activity Level ── */}
      <Animated.View entering={entering[5]}>
        <Text variant="label" style={styles.sectionLabel}>Activity Level</Text>
        <Card padded={false} style={styles.card}>
          {ACTIVITY_OPTIONS.map((opt, index) => {
            const selected = activity === opt.key;
            return (
              <AnimatedPressable key={opt.key} onPress={() => setActivity(opt.key)} haptic="selection">
                <Animated.View
                  style={[
                    styles.activityRow,
                    index < ACTIVITY_OPTIONS.length - 1 && styles.activityRowBorder,
                    {
                      backgroundColor: selected ? Colors.primaryMuted : Colors.transparent,
                      transitionProperty: 'backgroundColor',
                      transitionDuration: Motion.duration.fast,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={selected ? Colors.primary : Colors.textSecondary}
                    style={styles.activityIcon}
                  />
                  <View style={styles.activityBody}>
                    <Text variant="body" weight="semibold" color={selected ? Colors.primary : Colors.textPrimary}>
                      {opt.label}
                    </Text>
                    <Text variant="label" weight="regular" color={Colors.textMuted}>{opt.desc}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioActive]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </Animated.View>
              </AnimatedPressable>
            );
          })}
        </Card>
      </Animated.View>

      {/* ── Save ── */}
      <Animated.View entering={entering[6]}>
        <Button
          title="Save Profile"
          onPress={handleSave}
          loading={saving}
          size="lg"
          fullWidth
          haptic="medium"
          testID="save-profile"
          style={styles.saveBtn}
        />
      </Animated.View>
    </Screen>
  );
}

/* ─── Field sub-component ─────────────────────────────────── */
interface FieldProps {
  icon: IconName; label: string; placeholder: string; suffix?: string;
  value: string; onChangeText: (v: string) => void;
  keyboardType: 'default' | 'number-pad' | 'decimal-pad';
  focused: boolean; onFocus: () => void; onBlur: () => void;
}
function Field({ icon, label, placeholder, suffix, value, onChangeText, keyboardType, focused, onFocus, onBlur }: FieldProps) {
  return (
    <View style={fieldStyles.row}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} style={fieldStyles.icon} />
      <Text variant="body" weight="semibold" color={Colors.textPrimary}>{label}</Text>
      <View style={fieldStyles.spacer} />
      <Animated.View
        style={[
          fieldStyles.valueBox,
          {
            borderColor: focused ? Colors.primary : Colors.borderStrong,
            transitionProperty: 'borderColor',
            transitionDuration: Motion.duration.fast,
          },
        ]}
      >
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
          selectionColor={Colors.primary}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </Animated.View>
      {suffix && <Text variant="label" weight="regular" color={Colors.textMuted} style={fieldStyles.suffix}>{suffix}</Text>}
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

  avatarWrap: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: Radius.pill,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  sectionLabel: {
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: Spacing.sm, marginTop: Spacing.lg,
  },

  card:    { overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },

  dobValue: { paddingVertical: 7, alignItems: 'flex-end' },

  // Gender dropdown
  dropdownBtn: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // Modal overlay + sheets
  modalOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },

  // Gender picker sheet
  pickerSheet: { paddingTop: Spacing.lg, maxHeight: '50%' },
  pickerTitle: { marginBottom: Spacing.md },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerOptionActive: { backgroundColor: Colors.primaryMuted },
  pickerOptionText:   { flex: 1 },

  // BMI
  bmiChip: {
    marginTop: Spacing.sm, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgElevated, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  bmiDot: { width: 8, height: 8, borderRadius: 4 },

  // Activity list
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityIcon:      { width: 28, textAlign: 'center' },
  activityBody:      { flex: 1, gap: 1 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  // Save
  saveBtn: { marginTop: Spacing.xl },
});

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  icon:   { width: 24, textAlign: 'center' },
  spacer: { flex: 1 },
  valueBox: {
    minWidth: 110, backgroundColor: Colors.bgInput,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.sm,
  },
  input: {
    textAlign: 'right', fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold, color: Colors.textPrimary,
    paddingVertical: 7,
  },
  suffix: { minWidth: 22 },
});
