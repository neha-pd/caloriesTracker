import React, { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, Button, Input, Chip, Text } from '@/components/ui';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { Icons, IconName } from '@/constants/icons';

// ── Types ──────────────────────────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

const GENDER_OPTIONS: { key: Gender; icon: IconName; label: string }[] = [
  { key: 'male', icon: 'male', label: 'Male' },
  { key: 'female', icon: 'female', label: 'Female' },
  { key: 'other', icon: Icons.gender, label: 'Other' },
  { key: 'prefer_not_to_say', icon: 'help-circle-outline', label: 'Prefer not' },
];

const ACTIVITY_OPTIONS: { key: ActivityLevel; icon: IconName; label: string; desc: string }[] = [
  { key: 'sedentary', icon: Icons.activity.sedentary, label: 'Sedentary', desc: 'Little or no exercise' },
  { key: 'lightly_active', icon: Icons.activity.light, label: 'Light', desc: '1–3 days/week' },
  { key: 'moderately_active', icon: Icons.activity.moderate, label: 'Moderate', desc: '3–5 days/week' },
  { key: 'very_active', icon: Icons.activity.active, label: 'Very Active', desc: '6–7 days/week' },
  { key: 'extra_active', icon: Icons.activity.veryActive, label: 'Extra Active', desc: 'Physical job or 2×/day' },
];

interface Props {
  birthDate: Date | null;
  onBirthDateChange: (d: Date) => void;
  age: number | null;
  height: string;
  onHeightChange: (v: string) => void;
  weight: string;
  onWeightChange: (v: string) => void;
  gender: Gender | null;
  onGenderChange: (g: Gender) => void;
  activity: ActivityLevel | null;
  onActivityChange: (a: ActivityLevel) => void;
  bmi: string | null;
  saving: boolean;
  onNext: () => void;
}

/** Step 1 — physical profile: DOB, height, weight, gender, activity, live BMI. */
export function StepProfile({
  birthDate,
  onBirthDateChange,
  age,
  height,
  onHeightChange,
  weight,
  onWeightChange,
  gender,
  onGenderChange,
  activity,
  onActivityChange,
  bmi,
  saving,
  onNext,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const selectedGenderOption = GENDER_OPTIONS.find((g) => g.key === gender);
  const selectedActivityOption = ACTIVITY_OPTIONS.find((a) => a.key === activity);

  return (
    <View>
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(250)}>
        <Text variant="hero" style={styles.title}>
          Tell us about yourself
        </Text>
        <Text variant="body" style={styles.subtitle}>
          We use this to calculate your personalised calorie and macro targets.
        </Text>
      </Animated.View>

      {/* ── Gender ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(50)}>
        <Text variant="label" style={styles.sectionLabel}>
          Gender
        </Text>
        <AnimatedPressable
          onPress={() => setShowGenderPicker(true)}
          haptic="light"
          style={styles.fieldRow}
          accessibilityRole="button"
        >
          {selectedGenderOption ? (
            <View style={styles.fieldValue}>
              <Ionicons name={selectedGenderOption.icon} size={18} color={Colors.primary} />
              <Text variant="body" color={Colors.textPrimary} weight="semibold">
                {selectedGenderOption.label}
              </Text>
            </View>
          ) : (
            <View style={styles.fieldValue}>
              <Ionicons name={Icons.gender} size={18} color={Colors.textMuted} />
              <Text variant="body" color={Colors.textMuted}>
                Select gender
              </Text>
            </View>
          )}
          <Ionicons name={Icons.chevronDown} size={16} color={Colors.textMuted} />
        </AnimatedPressable>
      </Animated.View>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
          <Animated.View
            entering={SlideInDown.duration(Motion.duration.base)}
            style={styles.pickerSheet}
          >
            <Text variant="subheading" center style={styles.pickerTitle}>
              Select Gender
            </Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const selected = gender === item.key;
                return (
                  <AnimatedPressable
                    haptic="selection"
                    onPress={() => {
                      onGenderChange(item.key);
                      setShowGenderPicker(false);
                    }}
                    style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={selected ? Colors.primary : Colors.textSecondary}
                    />
                    <Text
                      variant="body"
                      weight="semibold"
                      color={selected ? Colors.primary : Colors.textPrimary}
                      style={styles.pickerOptionText}
                    >
                      {item.label}
                    </Text>
                    {selected && <Ionicons name={Icons.check} size={18} color={Colors.primary} />}
                  </AnimatedPressable>
                );
              }}
            />
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Date of Birth ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(100)}>
        <Text variant="label" style={styles.sectionLabel}>
          Date of Birth
        </Text>
        <AnimatedPressable
          onPress={() => setShowDatePicker(true)}
          haptic="light"
          style={styles.fieldRow}
          accessibilityRole="button"
        >
          <View style={styles.fieldValue}>
            <Ionicons
              name={Icons.calendar}
              size={18}
              color={birthDate ? Colors.primary : Colors.textMuted}
            />
            <Text
              variant="body"
              color={birthDate ? Colors.textPrimary : Colors.textMuted}
              weight={birthDate ? 'semibold' : 'regular'}
            >
              {birthDate
                ? birthDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Select your date of birth'}
            </Text>
          </View>
          <View style={styles.fieldValue}>
            {age !== null && (
              <View style={styles.ageBadge}>
                <Text variant="caption" weight="bold" color={Colors.primary}>
                  {age} yrs
                </Text>
              </View>
            )}
            <Ionicons name={Icons.chevronDown} size={16} color={Colors.textMuted} />
          </View>
        </AnimatedPressable>
      </Animated.View>

      {showDatePicker &&
        (Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
              <Animated.View
                entering={SlideInDown.duration(Motion.duration.base)}
                style={styles.datePickerSheet}
              >
                <View style={styles.datePickerHeader}>
                  <Text variant="subheading">Select Date of Birth</Text>
                  <AnimatedPressable haptic="light" onPress={() => setShowDatePicker(false)}>
                    <Text variant="body" weight="bold" color={Colors.primary}>
                      Done
                    </Text>
                  </AnimatedPressable>
                </View>
                <DateTimePicker
                  value={birthDate ?? new Date(1995, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={(_, date) => {
                    if (date) onBirthDateChange(date);
                  }}
                  textColor={Colors.textPrimary}
                />
              </Animated.View>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={birthDate ?? new Date(1995, 0, 1)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) onBirthDateChange(date);
            }}
          />
        ))}

      {/* ── Height + Weight ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(150)} style={styles.twoCol}>
        <View style={styles.col}>
          <Text variant="label" style={styles.sectionLabel}>
            Height
          </Text>
          <View style={styles.inlineField}>
            <View style={styles.flex}>
              <Input
                icon={Icons.height}
                placeholder="e.g. 165"
                keyboardType="decimal-pad"
                value={height}
                onChangeText={onHeightChange}
              />
            </View>
            <Text variant="label" style={styles.unit}>
              cm
            </Text>
          </View>
        </View>
        <View style={styles.col}>
          <Text variant="label" style={styles.sectionLabel}>
            Weight
          </Text>
          <View style={styles.inlineField}>
            <View style={styles.flex}>
              <Input
                icon={Icons.weight}
                placeholder="e.g. 65"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={onWeightChange}
              />
            </View>
            <Text variant="label" style={styles.unit}>
              kg
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── BMI live preview ── */}
      {bmi && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.bmiChip}>
          <Ionicons name={Icons.trendingUp} size={14} color={Colors.textSecondary} />
          <Text variant="label">{bmi}</Text>
        </Animated.View>
      )}

      {/* ── Activity Level ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(200)}>
        <Text variant="label" style={styles.sectionLabel}>
          Activity Level
        </Text>
        <View style={styles.chipWrap}>
          {ACTIVITY_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              selected={activity === opt.key}
              onPress={() => onActivityChange(opt.key)}
              testID={`onboarding-activity-${opt.key}`}
            />
          ))}
        </View>
        {selectedActivityOption && (
          <Text variant="caption" style={styles.activityDesc}>
            {selectedActivityOption.desc}
          </Text>
        )}
      </Animated.View>

      {/* ── Continue ── */}
      <Animated.View entering={FadeInDown.duration(250).delay(250)}>
        <Button
          title="Continue"
          onPress={onNext}
          loading={saving}
          size="lg"
          fullWidth
          haptic="medium"
          style={styles.nextBtn}
          testID="onboarding-next"
        />
      </Animated.View>
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

  // Trigger rows (gender / DOB) — styled like the Input primitive
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ageBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },

  // Modal sheets
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: Spacing.lg,
    paddingBottom: 34,
    maxHeight: '50%',
  },
  pickerTitle: { marginBottom: Spacing.md },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerOptionActive: { backgroundColor: Colors.primaryMuted },
  pickerOptionText: { flex: 1 },
  datePickerSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },

  // Height / weight
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  col: { flex: 1 },
  inlineField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unit: { minWidth: 24 },

  // BMI
  bmiChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },

  // Activity
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  activityDesc: { marginTop: Spacing.sm },

  nextBtn: { marginTop: Spacing.xl },
});
