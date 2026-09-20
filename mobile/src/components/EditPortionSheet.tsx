import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedNumber, AnimatedPressable, Button, Text } from '@/components/ui';
import { Icons, IconName } from '@/constants/icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import api from '@/lib/api';

const ITEM_H = 44;
const GRAMS_PER_OZ = 28.3495;

/** Wheel values per measure — a gram wheel of 0.25–10 would be meaningless. */
const SERVING_QUANTITIES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10];
const GRAM_QUANTITIES = [
  5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100, 110, 120, 125, 150, 175, 200,
  225, 250, 275, 300, 350, 400, 450, 500, 600, 700, 750, 800, 900, 1000,
];
const OZ_QUANTITIES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 32];

const WEIGHT_UNITS = ['g', 'gram', 'grams'];

export interface PortionEntry {
  id: string;
  meal_type: string;
  food_name?: string;
  status: string;
  quantity: number | string;
  serving_unit: string;
  calories: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  // Base nutrition of the linked food item (one serving_qty worth), when known.
  food_serving_qty?: number | string | null;
  food_serving_unit?: string | null;
  food_serving_weight_g?: number | string | null;
  food_calories?: number | string | null;
  food_protein_g?: number | string | null;
  food_carbs_g?: number | string | null;
  food_fat_g?: number | string | null;
  food_fiber_g?: number | string | null;
  food_piece_weight_g?: number | string | null;
}

interface Macro {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  grams: number | null; // net weight of one unit, when derivable
}

interface Measure {
  key: string;          // persisted as serving_unit — must match backend servingFactor
  label: string;        // wheel label
  quantities: number[]; // wheel values for this measure
  perUnit: Macro;
}

const num = (v: number | string | null | undefined): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

const trim = (n: number) => String(+n.toFixed(2));

/** Legacy/alias unit keys → the measure key they mean. */
const measureKey = (unit: string | null | undefined) =>
  !unit ? 'serving' : WEIGHT_UNITS.includes(unit) ? 'grams' : unit;

/** Index of the wheel value closest to `value`. */
function nearestIndex(values: number[], value: number) {
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(values[best] - value)) best = i;
  });
  return best;
}

/**
 * Measures available for an entry, in the order grams → piece → serve → oz,
 * mirrored by the backend's servingFactor:
 *   grams / oz — by weight, when the serving weight is known
 *   piece      — one natural piece ("1 egg"), only when USDA states its weight
 *   serve      — one whole serving of the food, labelled with what it is ("100 g")
 *   the food's own unit (e.g. cup) — when that unit isn't already a weight
 * AI/custom entries scale linearly from their current totals only.
 */
function buildMeasures(entry: PortionEntry): Measure[] {
  const baseCal = num(entry.food_calories);
  const unit = entry.food_serving_unit ?? 'serving';
  const isWeightUnit = WEIGHT_UNITS.includes(unit);
  const weight = num(entry.food_serving_weight_g);
  // Older cached foods stored "1 g" weighing 100 g; the weight is the truth.
  const servingQty = isWeightUnit && weight ? weight : num(entry.food_serving_qty);

  if (baseCal != null && servingQty && servingQty > 0) {
    const fiber = num(entry.food_fiber_g);
    const serving: Macro = {
      calories: baseCal,
      protein_g: num(entry.food_protein_g) ?? 0,
      carbs_g: num(entry.food_carbs_g) ?? 0,
      fat_g: num(entry.food_fat_g) ?? 0,
      fiber_g: fiber,
      grams: weight,
    };
    const scale = (m: Macro, k: number): Macro => ({
      calories: m.calories * k,
      protein_g: m.protein_g * k,
      carbs_g: m.carbs_g * k,
      fat_g: m.fat_g * k,
      fiber_g: m.fiber_g != null ? m.fiber_g * k : null,
      grams: m.grams != null ? m.grams * k : null,
    });

    const isPlainServing = unit === 'serving' && servingQty === 1;
    const perGram = weight && weight > 0 ? scale(serving, 1 / weight) : null;
    const pieceG = num(entry.food_piece_weight_g);
    const measures: Measure[] = [];

    if (perGram) {
      measures.push({ key: 'grams', label: 'grams', quantities: GRAM_QUANTITIES, perUnit: perGram });
      if (pieceG && pieceG > 0) {
        measures.push({ key: 'piece', label: `piece (${trim(pieceG)} g)`, quantities: SERVING_QUANTITIES, perUnit: scale(perGram, pieceG) });
      }
    }
    measures.push({
      key: 'serving',
      label: isPlainServing ? 'serve' : `serve (${trim(servingQty)} ${isWeightUnit ? 'g' : unit})`,
      quantities: SERVING_QUANTITIES,
      perUnit: serving,
    });
    if (!isWeightUnit && unit !== 'serving') {
      measures.push({ key: unit, label: unit, quantities: SERVING_QUANTITIES, perUnit: scale(serving, 1 / servingQty) });
    }
    if (perGram) {
      measures.push({ key: 'oz', label: 'oz', quantities: OZ_QUANTITIES, perUnit: scale(perGram, GRAMS_PER_OZ) });
    }
    return measures;
  }

  // No food item (AI scan / custom): scale from the entry's own totals.
  const qty = num(entry.quantity) || 1;
  const perEntryUnit = (v: number | string | null | undefined) => (num(v) ?? 0) / qty;
  return [
    {
      key: entry.serving_unit || 'serving',
      label: entry.serving_unit || 'serving',
      quantities: SERVING_QUANTITIES,
      perUnit: {
        calories: perEntryUnit(entry.calories),
        protein_g: perEntryUnit(entry.protein_g),
        carbs_g: perEntryUnit(entry.carbs_g),
        fat_g: perEntryUnit(entry.fat_g),
        fiber_g: null,
        grams: null,
      },
    },
  ];
}

/**
 * Snap wheel: FlatList with snapToInterval, one item of vertical padding so
 * first/last values can center. Selection haptic fires when a new value
 * settles under the band — the moment the detent catches, not on Done.
 */
function Wheel({
  items,
  index,
  onChange,
  testID,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  testID?: string;
}) {
  const ref = useRef<FlatList<string>>(null);
  // Index the list is physically showing. A scroll settle updates it; any
  // other index change (sheet reopened, unit switched) repositions the list.
  const shown = useRef(-1);

  useEffect(() => {
    if (index === shown.current) return;
    ref.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
    shown.current = index;
  }, [index, items]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(
      items.length - 1,
      Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H))
    );
    shown.current = i;
    if (i !== index) {
      Haptics.selectionAsync();
      onChange(i);
    }
  };

  return (
    <View style={styles.wheel} testID={testID}>
      <View pointerEvents="none" style={styles.wheelBand} />
      <FlatList
        ref={ref}
        data={items}
        keyExtractor={(item, i) => `${item}-${i}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: i * ITEM_H, index: i })}
        contentContainerStyle={styles.wheelContent}
        renderItem={({ item, index: i }) => (
          <View style={styles.wheelItem}>
            <Text
              variant="subheading"
              color={i === index ? Colors.textPrimary : Colors.textMuted}
              weight={i === index ? 'bold' : 'medium'}
            >
              {item}
            </Text>
          </View>
        )}
        extraData={index}
      />
    </View>
  );
}

function MacroRow({ icon, label, value }: { icon: IconName; label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <View style={styles.macroRow}>
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
      <Text variant="body" color={Colors.textPrimary} style={styles.macroLabel}>
        {label}
      </Text>
      <Text variant="body" weight="bold" color={Colors.textPrimary}>
        {value.toFixed(1)} g
      </Text>
    </View>
  );
}

/** A food chosen from search — portion is picked before the entry exists. */
export interface FoodPick {
  id?: string;
  name: string;
  brand?: string | null;
  serving_qty?: number | string | null;
  serving_unit?: string | null;
  serving_weight_g?: number | string | null;
  calories: number | string;
  protein_g?: number | string | null;
  carbs_g?: number | string | null;
  fat_g?: number | string | null;
  fiber_g?: number | string | null;
  piece_weight_g?: number | string | null;
}

interface Props {
  entry?: PortionEntry | null;
  food?: FoodPick | null;
  onClose: () => void;
  onSaved: () => void;
  /** Add mode: called with the picked portion instead of PATCHing. */
  onConfirm?: (quantity: number, servingUnit: string) => Promise<void>;
}

export default function EditPortionSheet({ entry, food, onClose, onSaved, onConfirm }: Props) {
  const [saving, setSaving] = useState(false);
  const [qtyIndex, setQtyIndex] = useState(3); // "1"
  const [measureIndex, setMeasureIndex] = useState(0);

  // A picked food behaves like a 1-unit entry with full base nutrition.
  const target: PortionEntry | null = useMemo(() => {
    if (entry) return entry;
    if (!food) return null;
    const unit = food.serving_unit ?? 'serving';
    return {
      id: food.id ?? '',
      meal_type: '',
      food_name: food.name,
      status: 'manual',
      quantity: num(food.serving_qty) ?? 1,
      serving_unit: unit,
      calories: food.calories,
      protein_g: food.protein_g ?? 0,
      carbs_g: food.carbs_g ?? 0,
      fat_g: food.fat_g ?? 0,
      food_serving_qty: food.serving_qty ?? 1,
      food_serving_unit: unit,
      food_serving_weight_g: food.serving_weight_g,
      food_calories: food.calories,
      food_protein_g: food.protein_g ?? 0,
      food_carbs_g: food.carbs_g ?? 0,
      food_fat_g: food.fat_g ?? 0,
      food_fiber_g: food.fiber_g,
      food_piece_weight_g: food.piece_weight_g,
    };
  }, [entry, food]);

  const measures = useMemo(() => (target ? buildMeasures(target) : []), [target]);

  // Seed the wheels each time the sheet opens: the entry's saved portion when
  // editing; when adding, 1 piece if the food has one, otherwise 1 serve.
  useEffect(() => {
    if (!target) return;
    const addKey = measures.some((m) => m.key === 'piece') ? 'piece' : 'serving';
    const key = entry ? measureKey(target.serving_unit) : addKey;
    const mIdx = Math.max(0, measures.findIndex((m) => m.key === key));
    const qty = entry ? num(target.quantity) || 1 : 1;
    setMeasureIndex(mIdx);
    setQtyIndex(nearestIndex(measures[mIdx]?.quantities ?? SERVING_QUANTITIES, qty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, food?.id, food?.name]);

  const measure = measures[Math.min(measureIndex, measures.length - 1)];
  const quantities = measure?.quantities ?? SERVING_QUANTITIES;
  const qty = quantities[Math.min(qtyIndex, quantities.length - 1)] ?? 1;

  // Switching units keeps the amount of food: 1 serving (100 g) → 100 grams.
  const changeMeasure = (i: number) => {
    const next = measures[i];
    if (!next || !measure) return setMeasureIndex(i);
    const grams = measure.perUnit.grams != null ? measure.perUnit.grams * qty : null;
    const nextQty = grams != null && next.perUnit.grams ? grams / next.perUnit.grams : 1;
    setMeasureIndex(i);
    setQtyIndex(nearestIndex(next.quantities, nextQty));
  };

  const totals = useMemo(() => {
    if (!measure) return null;
    const p = measure.perUnit;
    return {
      calories: p.calories * qty,
      protein_g: p.protein_g * qty,
      carbs_g: p.carbs_g * qty,
      fat_g: p.fat_g * qty,
      fiber_g: p.fiber_g != null ? p.fiber_g * qty : null,
      grams: p.grams != null ? p.grams * qty : null,
    };
  }, [measure, qty]);

  const handleDone = async () => {
    if (!target || !totals || !measure) return;
    setSaving(true);
    try {
      if (entry) {
        await api.patch(`/api/logs/entries/${entry.id}`, {
          quantity: qty,
          serving_unit: measure.key,
          calories: +totals.calories.toFixed(2),
          protein_g: +totals.protein_g.toFixed(2),
          carbs_g: +totals.carbs_g.toFixed(2),
          fat_g: +totals.fat_g.toFixed(2),
          is_user_overridden: true,
        });
      } else if (onConfirm) {
        await onConfirm(qty, measure.key);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch {
      Alert.alert('Error', entry ? 'Could not update the portion.' : 'Could not log food item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="edit-portion-sheet">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="subheading" numberOfLines={1}>
                {target?.food_name ?? 'Edit portion'}
              </Text>
              <Text variant="caption">Macronutrients breakdown</Text>
            </View>
            <AnimatedPressable onPress={onClose} haptic="light" accessibilityLabel="Close portion editor">
              <Ionicons name={Icons.close} size={24} color={Colors.textSecondary} />
            </AnimatedPressable>
          </View>

          {/* Breakdown card — values track the wheels live */}
          <View style={styles.breakdown}>
            <View style={styles.caloriesRow}>
              <View>
                <Text variant="caption">Calories</Text>
                <View style={styles.caloriesValue}>
                  <AnimatedNumber value={Math.round(totals?.calories ?? 0)} style={styles.caloriesText} />
                  <Text variant="body" color={Colors.textSecondary} style={styles.caloriesUnit}>
                    Cal
                  </Text>
                </View>
              </View>
              {totals?.grams != null && (
                <View style={styles.netWtPill}>
                  <Text variant="caption" color={Colors.textSecondary}>
                    Net wt: {totals.grams.toFixed(1)} g
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.divider} />
            <MacroRow icon={Icons.protein} label="Proteins" value={totals?.protein_g ?? 0} />
            <MacroRow icon={Icons.fat} label="Fats" value={totals?.fat_g ?? 0} />
            <MacroRow icon={Icons.carbs} label="Carbs" value={totals?.carbs_g ?? 0} />
            <MacroRow icon={Icons.fiber} label="Fiber" value={totals?.fiber_g ?? null} />
          </View>

          {/* Pickers */}
          <View style={styles.pickerHeader}>
            <Text variant="label" style={styles.pickerCol}>
              Quantity
            </Text>
            <Text variant="label" style={styles.pickerCol}>
              Measure
            </Text>
          </View>
          <View style={styles.pickers}>
            <Wheel
              items={quantities.map((q) => String(q))}
              index={qtyIndex}
              onChange={setQtyIndex}
              testID="portion-quantity-wheel"
            />
            <Wheel
              items={measures.map((m) => m.label)}
              index={measureIndex}
              onChange={changeMeasure}
              testID="portion-measure-wheel"
            />
          </View>

          <Button
            title={entry ? 'Done' : 'Add to meal'}
            onPress={handleDone}
            loading={saving}
            fullWidth
            size="lg"
            haptic="none"
            testID="portion-done"
          />
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
  breakdown: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caloriesValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  caloriesText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.hero,
    fontWeight: Typography.weight.heavy,
  },
  caloriesUnit: {
    lineHeight: undefined,
  },
  netWtPill: {
    backgroundColor: Colors.bgCardMid,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
  },
  macroLabel: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pickerCol: {
    flex: 1,
    textAlign: 'center',
  },
  pickers: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  wheel: {
    flex: 1,
    height: ITEM_H * 3,
  },
  wheelBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H,
    height: ITEM_H,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardMid,
  },
  wheelContent: {
    paddingVertical: ITEM_H,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
