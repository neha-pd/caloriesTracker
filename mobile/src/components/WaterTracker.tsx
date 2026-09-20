import React, { useEffect, useState } from 'react';
import { Keyboard, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { Icons } from '@/constants/icons';
import { AnimatedPressable, Button, Card, Input, Text } from '@/components/ui';
import { MAX_WATER_ADD_ML, MAX_WATER_TOTAL_ML, useWater } from '@/lib/hooks/useWater';

const DEFAULT_WATER_GOAL_ML = 2500;
const GLASS_COUNT = 8;
/** Every glass holds a multiple of this, so round adds (250, 500 ml) fill whole glasses. */
const GLASS_STEP_ML = 50;

/**
 * Snap a goal to the nearest multiple of GLASS_COUNT × GLASS_STEP_ML (400 ml).
 * A raw goal like 2100 ml would make each glass 262.5 ml, so a 250 ml glass of
 * water never quite fills one; 2000 ml makes each glass exactly 250 ml.
 */
function roundWaterGoal(goalMl: number) {
  const unit = GLASS_COUNT * GLASS_STEP_ML;
  return Math.max(unit, Math.round(goalMl / unit) * unit);
}

interface Props {
  waterMl:      number;
  onUpdate:     () => void;
  waterGoalMl?: number;  // optional custom goal (weight_kg * 35)
}

/**
 * One glass tile with a water level. `fill` is 0–1: the glass's share of the
 * day's water, so a 50 ml add shows as a small rise in the next glass.
 * Tapping sets the day's water to this glass — a glass holding any water
 * empties itself and every glass after it, an empty glass fills up to it.
 *
 * The level is an absolutely-positioned, childless, bottom-anchored view in a
 * fixed-height tile, so animating its height re-lays out nothing else.
 */
function Glass({
  index,
  fill,
  onPress,
}: {
  index: number;
  fill: number;
  onPress: () => void;
}) {
  const level = useSharedValue(fill);

  useEffect(() => {
    level.set(
      withTiming(fill, {
        duration: Motion.duration.slow,
        easing: Motion.easing.out,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [fill, level]);

  const levelStyle = useAnimatedStyle(() => ({
    height: `${level.get() * 100}%`,
  }));

  const full = fill >= 1;
  const percent = Math.round(fill * 100);

  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.92}
      containerStyle={styles.glassItem}
      accessibilityRole="button"
      accessibilityLabel={
        fill > 0
          ? `Glass ${index + 1}, ${percent}% full. Tap to remove.`
          : `Glass ${index + 1}, empty. Tap to fill up to here.`
      }
      testID={`water-glass-${index}`}
    >
      <View style={styles.glass}>
        <Animated.View style={[styles.glassLevel, levelStyle]} />
        <Ionicons
          name={full ? Icons.water : Icons.waterOutline}
          size={14}
          color={fill > 0 ? Colors.white : Colors.textMuted}
        />
      </View>
    </AnimatedPressable>
  );
}

export default function WaterTracker({ waterMl, onUpdate, waterGoalMl }: Props) {
  const { addWater, setWater } = useWater(waterMl, onUpdate);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();

  const submit = async () => {
    const ml = Number(amount);
    if (!amount || !Number.isInteger(ml) || ml <= 0) {
      setError('Enter an amount in ml');
      return;
    }
    if (ml > MAX_WATER_ADD_ML) {
      setError(`Add up to ${MAX_WATER_ADD_ML.toLocaleString()} ml at a time`);
      return;
    }
    if (waterMl + ml > MAX_WATER_TOTAL_ML) {
      setError("That's over today's maximum");
      return;
    }
    Keyboard.dismiss();
    if (await addWater(ml)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAmount('');
      setError(undefined);
    }
  };

  const GOAL_ML = roundWaterGoal(waterGoalMl ?? DEFAULT_WATER_GOAL_ML);
  const pct    = Math.min(100, Math.round((waterMl / GOAL_ML) * 100));
  const perGlassMl = GOAL_ML / GLASS_COUNT; // always a multiple of GLASS_STEP_ML

  // Each glass holds perGlassMl; its fill is whatever of the day's water
  // lands in its slot.
  const glassFill = (i: number) => Math.min(1, Math.max(0, waterMl / perGlassMl - i));

  const onGlassPress = (i: number) =>
    setWater((glassFill(i) > 0 ? i : i + 1) * perGlassMl);

  return (
    <Card style={styles.card} testID="water-tracker">
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Ionicons name={Icons.water} size={16} color={Colors.water} />
            <Text variant="subheading">Water</Text>
          </View>
          <Text variant="subheading" color={Colors.water} style={styles.value}>
            {/* Two decimals so small adds (e.g. 50 ml) are visible. */}
            {+(waterMl / 1000).toFixed(2)} L{' '}
            <Text variant="label" color={Colors.textMuted}>
              / {GOAL_ML / 1000} L
            </Text>
          </Text>
        </View>
        <Text variant="subheading" color={pct >= 100 ? Colors.primary : Colors.textSecondary}>
          {pct}%
        </Text>
      </View>

      <View style={styles.glassRow}>
        {Array.from({ length: GLASS_COUNT }).map((_, i) => (
          <Glass
            key={i}
            index={i}
            fill={glassFill(i)}
            onPress={() => onGlassPress(i)}
          />
        ))}
      </View>

      <View style={styles.customRow}>
        <View style={styles.customInput}>
          <Input
            value={amount}
            onChangeText={(t) => {
              setAmount(t.replace(/[^0-9]/g, ''));
              if (error) setError(undefined);
            }}
            placeholder="Amount"
            keyboardType="number-pad"
            // A plain number field: no iOS edit menu (AutoFill / Scan Text /
            // paste callout) on tap, no autofill or correction suggestions.
            contextMenuHidden
            textContentType="none"
            autoComplete="off"
            importantForAutofill="no"
            autoCorrect={false}
            spellCheck={false}
            maxLength={4}
            error={error}
            style={styles.inputText}
            accessibilityLabel="Water amount in millilitres"
            testID="water-custom-input"
          />
          <Text variant="label" color={Colors.textMuted} style={styles.unit} pointerEvents="none">
            ml
          </Text>
        </View>
        <Button
          title="Add"
          icon={Icons.add}
          onPress={submit}
          disabled={!amount}
          haptic="none"
          style={styles.addBtn}
          testID="water-custom-add"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  value: {
    marginTop: Spacing.xs,
  },
  glassRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  glassItem: {
    flex: 1,
  },
  glass: {
    height: 40,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  glassLevel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.water,
  },
  // Button top-aligns with the field so a validation message below the
  // input doesn't push it off-centre.
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  customInput: {
    flex: 1,
  },
  inputText: {
    paddingRight: Spacing.lg, // room for the "ml" suffix
  },
  unit: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    height: 52, // Input field height
    lineHeight: 52,
  },
  addBtn: {
    height: 52,
  },
});
