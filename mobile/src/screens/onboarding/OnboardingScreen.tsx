import React, { useRef, useState } from 'react';
import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { ProgressBar, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { StepProfile, Gender, ActivityLevel } from './StepProfile';
import { StepGoals, GoalType } from './StepGoals';

/**
 * Two-step onboarding wizard. Owns all form state (so values survive going
 * back), progress, step transitions, and both API submits; the step components
 * are presentational.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // True once we've left step 1 — step 1 then re-enters with a slide, not the
  // first-mount stagger.
  const hasNavigated = useRef(false);

  // Step 1 — Physical Profile
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);

  // Step 2 — Goals
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const [saving, setSaving] = useState(false);

  /* ── Calculate age from birthdate ─────────────────────────── */
  const calculateAge = (dob: Date): number => {
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    return a;
  };

  const age = birthDate ? calculateAge(birthDate) : null;

  // ── BMI ────────────────────────────────────────────────────────────────
  const bmi = (() => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (!h || !w || isNaN(h) || isNaN(w)) return null;
    const val = (w / (h * h)).toFixed(1);
    const n = parseFloat(val);
    const cat = n < 18.5 ? 'Underweight' : n < 25 ? 'Healthy' : n < 30 ? 'Overweight' : 'Obese';
    return `BMI ${val} — ${cat}`;
  })();

  // ── Step 1 → 2: Save physical profile ─────────────────────────────────
  const handleProfileNext = async () => {
    if (!age || !height || !weight) {
      return Alert.alert('Required', 'Please enter your date of birth, height, and weight to continue.');
    }
    if (!gender) return Alert.alert('Required', 'Please select your gender.');
    if (!activity) return Alert.alert('Required', 'Please select your activity level.');

    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);

    if (age < 10 || age > 120)
      return Alert.alert('Invalid', 'Age must be between 10 and 120.');
    if (isNaN(heightN) || heightN < 50 || heightN > 300)
      return Alert.alert('Invalid', 'Height must be between 50 and 300 cm.');
    if (isNaN(weightN) || weightN < 10 || weightN > 500)
      return Alert.alert('Invalid', 'Weight must be between 10 and 500 kg.');

    setSaving(true);
    try {
      const { data } = await api.patch('/api/users/me', {
        age, gender, height_cm: heightN, weight_kg: weightN, activity_level: activity,
      });
      updateUser({
        age: data.user.age, gender: data.user.gender,
        height_cm: data.user.height_cm, weight_kg: data.user.weight_kg,
        activity_level: data.user.activity_level,
      });
      // Auto-calculate right away with the default goal type
      await autoCalculate('maintain');
      hasNavigated.current = true;
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-calculate from server ─────────────────────────────────────────
  const autoCalculate = async (gt: GoalType) => {
    setCalcLoading(true);
    try {
      const { data } = await api.get(`/api/users/me/goals/calculate?goal_type=${gt}`);
      setCalories(String(data.calorie_goal));
      setProtein(String(data.protein_g));
      setCarbs(String(data.carbs_g));
      setFat(String(data.fat_g));
      setCalculated(true);
    } catch {
      // If calculation fails (shouldn't happen since we just saved profile) leave fields empty
    } finally {
      setCalcLoading(false);
    }
  };

  const handleGoalChange = async (gt: GoalType) => {
    setGoalType(gt);
    await autoCalculate(gt);
  };

  // ── Step 2 → Dashboard: Save goals ────────────────────────────────────
  const handleFinish = async () => {
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 500)
      return Alert.alert('Invalid', 'Please enter a valid calorie goal (min 500 kcal).');

    setSaving(true);
    try {
      await api.patch('/api/users/me/goals', {
        goal_type: goalType,
        calorie_goal: cal,
        protein_goal_g: parseInt(protein, 10) || undefined,
        carbs_goal_g: parseInt(carbs, 10) || undefined,
        fat_goal_g: parseInt(fat, 10) || undefined,
      });
      // Update local auth store so Profile page shows correct values immediately
      updateUser({
        goal_type: goalType,
        calorie_goal: cal,
        protein_goal_g: parseInt(protein, 10) || undefined,
        carbs_goal_g: parseInt(carbs, 10) || undefined,
        fat_goal_g: parseInt(fat, 10) || undefined,
      });
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Could not save goals.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar barStyle="light-content" />

      {/* ── Progress ── */}
      <View style={styles.progressWrap}>
        <ProgressBar progress={step / 2} height={4} />
        <Text variant="caption">Step {step} of 2</Text>
      </View>

      {/* Step 1 only ever exits forward (out left) and re-enters backward
          (in from left); step 2 only enters forward and exits backward —
          so each step's animations are static. */}
      {step === 1 && (
        <Animated.View
          key="step-profile"
          entering={hasNavigated.current ? SlideInLeft.duration(250) : undefined}
          exiting={SlideOutLeft.duration(200)}
        >
          <StepProfile
            birthDate={birthDate}
            onBirthDateChange={setBirthDate}
            age={age}
            height={height}
            onHeightChange={setHeight}
            weight={weight}
            onWeightChange={setWeight}
            gender={gender}
            onGenderChange={setGender}
            activity={activity}
            onActivityChange={setActivity}
            bmi={bmi}
            saving={saving}
            onNext={handleProfileNext}
          />
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View
          key="step-goals"
          entering={SlideInRight.duration(250)}
          exiting={SlideOutRight.duration(200)}
        >
          <StepGoals
            goalType={goalType}
            onGoalTypeChange={handleGoalChange}
            calories={calories}
            onCaloriesChange={setCalories}
            protein={protein}
            onProteinChange={setProtein}
            carbs={carbs}
            onCarbsChange={setCarbs}
            fat={fat}
            onFatChange={setFat}
            calcLoading={calcLoading}
            saving={saving}
            onBack={() => setStep(1)}
            onFinish={handleFinish}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
});
