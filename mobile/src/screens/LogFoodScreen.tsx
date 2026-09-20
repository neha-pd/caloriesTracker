import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
// NOTE: expo-image is avoided deliberately — importing it wedges app startup
// on this native build (silent hang before first render). RN Image works fine.
import { Image } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  AnimatedPressable,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { Icons } from '@/constants/icons';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { useLogStore } from '@/store/logStore';
import EditPortionSheet, { FoodPick, PortionEntry } from '@/components/EditPortionSheet';
import api from '@/lib/api';
import { formatPortion } from '@/lib/portion';

/**
 * Scan-in-progress card: pulsing indicator (opacity/scale only, UI thread,
 * ReduceMotion.System respected) beside the picked photo and a caption.
 */
type EnteringProp = React.ComponentProps<typeof Animated.View>['entering'];

function ScanningCard({ uri, entering }: { uri: string | null; entering: EnteringProp }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    pulse.set(
      withRepeat(
        withTiming(0.55, {
          duration: 700,
          easing: Motion.easing.inOut,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true
      )
    );
  }, [reduced, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.get(),
    transform: [{ scale: 0.96 + 0.04 * pulse.get() }],
  }));

  return (
    <Animated.View entering={entering}>
      <Card style={styles.scanningCard} testID="scan-in-progress">
        {uri ? (
          <Image source={{ uri }} style={styles.scanThumb} resizeMode="cover" />
        ) : null}
        <View style={styles.scanningInfo}>
          <Text variant="subheading">AI Vision Scan</Text>
          <Text variant="caption">Analyzing your photo…</Text>
        </View>
        <Animated.View style={[styles.pulseBadge, pulseStyle]}>
          <Ionicons name={Icons.camera} size={22} color={Colors.primary} />
        </Animated.View>
      </Card>
    </Animated.View>
  );
}

function SearchSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonText}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="35%" height={11} />
            <Skeleton width="70%" height={11} />
          </View>
          <Skeleton width={40} height={40} radius={Radius.pill} />
        </View>
      ))}
    </View>
  );
}

type ExistingEntry = PortionEntry;

/** What a search result's nutrition refers to: "100 g", "1 cup", "serving". */
function servingLabel(food: FoodPick) {
  const unit = food.serving_unit ?? 'serving';
  const isGrams = ['g', 'gram', 'grams'].includes(unit);
  // Older cached results said "1 g" while meaning the whole serving weight.
  const qty = Number(isGrams && food.serving_weight_g ? food.serving_weight_g : food.serving_qty ?? 1);
  if (unit === 'serving' && qty === 1) return 'serving';
  return `${+qty.toFixed(2)} ${isGrams ? 'g' : unit}`;
}

export default function LogFoodScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { meal_type = 'snack' } = useLocalSearchParams<{ meal_type?: string }>();
  const addEntry  = useLogStore((s) => s.addEntry);
  const updateEntry = useLogStore((s) => s.updateEntry);

  const [query, setQuery]     = useState('');
  const [search, setSearch]   = useState('');
  const [logging, setLogging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanUri, setScanUri] = useState<string | null>(null);
  const [customVisible, setCustomVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [editingEntry, setEditingEntry] = useState<ExistingEntry | null>(null);
  const [pickingFood, setPickingFood] = useState<FoodPick | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['food-search', search],
    queryFn: async () => {
      if (!search) return { foods: [] };
      const { data } = await api.get(`/api/foods/search?q=${encodeURIComponent(search)}`);
      return data;
    },
    enabled: search.length > 1,
  });

  const { data: dashboardData, isLoading: isLoadingExistingEntries } = useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard/today');
      return data as {
        meals?: Record<string, {
          calories: number;
          item_names?: string[];
        }>;
      };
    },
  });

  const { data: entriesData } = useQuery({
    queryKey: ['log-entries', 'today'],
    queryFn: async () => {
      const { data } = await api.get('/api/logs/entries');
      return data as { entries: ExistingEntry[] };
    },
  });

  // Entrance builders — 250ms, staggered 50ms, memoized so they aren't rebuilt
  // every render.
  const headerIn = useMemo(() => FadeInDown.duration(Motion.duration.base).easing(Motion.easing.out), []);
  const scanIn   = useMemo(() => FadeInUp.delay(50).duration(Motion.duration.base).easing(Motion.easing.out), []);
  const searchIn = useMemo(() => FadeInUp.delay(100).duration(Motion.duration.base).easing(Motion.easing.out), []);
  const listIn   = useMemo(() => FadeInUp.delay(150).duration(Motion.duration.base).easing(Motion.easing.out), []);
  // Result/scanning card: fade + rise + scale from 0.95 (never from 0).
  const cardIn = useMemo(
    () =>
      new Keyframe({
        0:   { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.95 }] },
        100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Motion.easing.out },
      })
        .duration(Motion.duration.base)
        .reduceMotion(ReduceMotion.System),
    []
  );

  // Every mutation must refresh every server-state view: the "Already added"
  // list on this screen, the dashboard totals underneath the modal, and the
  // day's History row.
  // (Invalidation refetches active queries immediately, bypassing staleTime.)
  const refreshLogQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['log-entries', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['history'] }),
    ]);

  const handlePhotoLog = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      return Alert.alert('Permission denied', 'Please allow access in Settings.');
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    setScanUri(asset.uri);

    try {
      const form = new FormData();
      form.append('file', {
        uri:  asset.uri,
        name: 'food.jpg',
        type: 'image/jpeg',
      } as any);

      const { data } = await api.post(`/api/logs/image?meal_type=${meal_type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      addEntry({
        id:           data.log_entry_id,
        meal_type:    meal_type as any,
        status:       'pending',
        calories:     null,
        protein_g:    null,
        carbs_g:      null,
        fat_g:        null,
        image_url:    asset.uri,
        quantity:     1,
        serving_unit: 'serving',
        is_user_overridden: false,
        logged_at:    new Date().toISOString(),
      });
      refreshLogQueries();

      const wsUrl = (api.defaults.baseURL ?? '').replace(/^http/, 'ws');
      const ws    = new WebSocket(`${wsUrl}/ws/log/${data.log_entry_id}`);

      // B6 fix: 30s timeout so the socket doesn't leak if the job never responds
      const wsTimeout = setTimeout(() => {
        ws.close();
      }, 30000);

      ws.onmessage = (event) => {
        clearTimeout(wsTimeout);
        const payload = JSON.parse(event.data);
        if (payload.type === 'nutrition_complete') {
          updateEntry(data.log_entry_id, {
            status:    'complete',
            calories:  payload.calories,
            protein_g: payload.protein_g,
            carbs_g:   payload.carbs_g,
            fat_g:     payload.fat_g,
            ai_confidence: payload.ai_confidence,
            ai_identified_items: payload.identified_items,
          });
          // Success haptic fired once, at the moment the result lands (paired
          // with the entry flipping to complete on the dashboard).
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refreshLogQueries();
        } else if (payload.type === 'nutrition_failed') {
          // B7 fix: '/log/edit' does not exist as a route (app/log/ has only
          // index.tsx), so the old router.push here crashed. There is no
          // manual-edit screen in the app — surface the failure instead and
          // let the user retry the scan or log via search. The entry is
          // already marked failed for the dashboard to render.
          updateEntry(data.log_entry_id, { status: 'failed' });
          refreshLogQueries();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Analysis failed',
            "We couldn't analyze that photo. Try scanning again, or search for the food to log it manually."
          );
        }
        ws.close();
      };

      ws.onerror = () => { clearTimeout(wsTimeout); ws.close(); };
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.error ?? 'Could not upload image.');
    } finally {
      setUploading(false);
      setScanUri(null);
    }
  };

  const handleManualLog = async (foodId: string, quantity = 1, servingUnit = 'serving') => {
    setLogging(true);
    try {
      const { data } = await api.post('/api/logs/entries', {
        food_item_id: foodId,
        meal_type,
        quantity,
        serving_unit: servingUnit,
      });
      addEntry(data.entry);
      setQuery('');
      setSearch('');
      await refreshLogQueries();
    } finally {
      // Errors propagate to the portion sheet, which alerts and stays open.
      setLogging(false);
    }
  };

  const openCustomFood = () => {
    setCustomName(search || query);
    setCustomVisible(true);
  };

  const handleCustomLog = async () => {
    const calories = Number(customCalories);
    if (!customName.trim() || !Number.isFinite(calories) || calories < 0) {
      Alert.alert('Missing details', 'Enter a food name and valid calories.');
      return;
    }

    setLogging(true);
    try {
      const { data: response } = await api.post('/api/logs/entries/custom', {
        name: customName.trim(),
        calories,
        protein_g: Number(customProtein) || 0,
        carbs_g: Number(customCarbs) || 0,
        fat_g: Number(customFat) || 0,
        meal_type,
      });
      addEntry(response.entry);
      setCustomVisible(false);
      setQuery('');
      setSearch('');
      await refreshLogQueries();
    } catch (err) {
      Alert.alert('Error', 'Could not add custom food.');
    } finally {
      setLogging(false);
    }
  };

  const handleDeleteEntry = (entry: ExistingEntry) => {
    Alert.alert(
      'Remove food?',
      `Remove ${entry.food_name ?? 'this food'} from ${meal_type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/logs/entries/${entry.id}`);
              await refreshLogQueries();
            } catch {
              Alert.alert('Error', 'Could not remove food item.');
            }
          },
        },
      ]
    );
  };

  const foods = data?.foods ?? [];
  const existingMeal = dashboardData?.meals?.[meal_type];
  const existingItems = (entriesData?.entries ?? []).filter(
    (entry) => entry.meal_type === meal_type && entry.status !== 'failed'
  );

  return (
    <Screen edges={['top', 'bottom']} testID="log-food-screen">
      {/* Header */}
      <Animated.View entering={headerIn} style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeBtn}
          testID="close-log"
        >
          <Ionicons name={Icons.chevronDown} size={28} color={Colors.textPrimary} />
        </AnimatedPressable>
        <View style={styles.headerText}>
          <Text variant="title" style={styles.titleCase} numberOfLines={1} adjustsFontSizeToFit>
            Add {meal_type}
          </Text>
          <Text variant="label">Find food or scan with AI</Text>
        </View>
      </Animated.View>

      {/* AI scan entry points — swapped for the pulsing card while uploading */}
      {uploading ? (
        <View style={styles.scanRow}>
          <ScanningCard uri={scanUri} entering={cardIn} />
        </View>
      ) : (
        <Animated.View entering={scanIn} style={[styles.scanRow, styles.scanButtons]}>
          <Button
            title="AI Vision Scan"
            icon={Icons.camera}
            onPress={() => handlePhotoLog(true)}
            size="lg"
            haptic="medium"
            style={styles.scanButton}
            testID="scan-food"
          />
          <AnimatedPressable
            onPress={() => handlePhotoLog(false)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Pick from gallery"
            style={styles.galleryBtn}
            testID="gallery-food"
          >
            <Ionicons name={Icons.gallery} size={24} color={Colors.textPrimary} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Search */}
      <Animated.View entering={searchIn} style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Input
            icon={Icons.search}
            placeholder="Search for any food..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSearch(query)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-food"
          />
        </View>
        {query.length > 0 && (
          <AnimatedPressable
            onPress={() => setSearch(query)}
            haptic="selection"
            style={styles.searchAction}
            testID="search-submit"
          >
            <Text variant="label" color={Colors.primary} weight="bold">
              Search
            </Text>
          </AnimatedPressable>
        )}
      </Animated.View>

      {/* Results */}
      {isFetching ? (
        <SearchSkeleton />
      ) : (
        // Container animates once — no per-row entering on FlatList rows.
        <Animated.View entering={listIn} style={styles.listWrap}>
          <FlatList
            data={foods}
            keyExtractor={(item) => item.id ?? item.external_id ?? item.name}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              existingItems.length > 0 || isLoadingExistingEntries ? (
                <View style={styles.existingSection}>
                  <Text variant="subheading" style={styles.existingTitle}>
                    Already added
                  </Text>
                  {isLoadingExistingEntries ? (
                    <Text variant="caption" color={Colors.textSecondary}>
                      Loading logged foods...
                    </Text>
                  ) : (
                    existingItems.map((entry) => {
                      const editable = entry.status !== 'pending' && entry.status !== 'processing';
                      return (
                        <View key={entry.id} style={styles.existingItem}>
                          <AnimatedPressable
                            onPress={() => editable && setEditingEntry(entry)}
                            disabled={!editable || logging}
                            haptic="selection"
                            style={styles.existingItemInfo}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit portion of ${entry.food_name ?? 'logged food'}`}
                            testID={`edit-entry-${entry.id}`}
                          >
                            <Text variant="body" weight="bold" numberOfLines={1}>
                              {entry.food_name ?? 'Logged food'}
                            </Text>
                            <Text variant="caption" color={Colors.textSecondary}>
                              {entry.status === 'pending' || entry.status === 'processing'
                                ? 'Analyzing...'
                                : `${Math.round(Number(entry.calories ?? 0))} kcal · ${formatPortion(entry.quantity, entry.serving_unit)}`}
                            </Text>
                          </AnimatedPressable>
                          {editable && (
                            <AnimatedPressable
                              onPress={() => setEditingEntry(entry)}
                              disabled={logging}
                              haptic="selection"
                              style={styles.entryAction}
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${entry.food_name ?? 'logged food'}`}
                            >
                              <Ionicons name={Icons.edit} size={17} color={Colors.textSecondary} />
                            </AnimatedPressable>
                          )}
                          <AnimatedPressable
                            onPress={() => handleDeleteEntry(entry)}
                            disabled={logging}
                            haptic="light"
                            style={styles.deleteButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${entry.food_name ?? 'logged food'}`}
                            testID={`delete-entry-${entry.id}`}
                          >
                            <Ionicons name="trash-outline" size={19} color={Colors.danger} />
                          </AnimatedPressable>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <AnimatedPressable
                onPress={() => {
                  // B4 fix: item.id may be undefined if the DB upsert for a
                  // Nutritionix result failed silently — prompt user to retry
                  if (!item.id) {
                    Alert.alert('Not ready', 'Food item is still being saved. Please tap again in a moment.');
                    return;
                  }
                  // Portion is chosen in the sheet before the entry is created.
                  setPickingFood(item);
                }}
                disabled={logging}
                haptic="light"
                style={styles.foodItem}
                testID={`food-result-${item.id ?? item.name}`}
              >
                <View style={styles.foodInfo}>
                  <Text variant="body" weight="bold" color={Colors.textPrimary} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text variant="caption" style={styles.foodBrand} numberOfLines={1}>
                    {item.brand ?? 'Generic Database'} · per {servingLabel(item)}
                  </Text>
                  <View style={styles.macroTags}>
                    <Text variant="caption" weight="bold">{Math.round(item.calories)} kcal</Text>
                    <View style={styles.macroDot} />
                    <Text variant="caption" weight="bold">P {Math.round(item.protein_g)}g</Text>
                    <View style={styles.macroDot} />
                    <Text variant="caption" weight="bold">C {Math.round(item.carbs_g)}g</Text>
                    <View style={styles.macroDot} />
                    <Text variant="caption" weight="bold">F {Math.round(item.fat_g)}g</Text>
                  </View>
                </View>
                <View style={styles.addButton}>
                  <Ionicons name={Icons.add} size={22} color={Colors.textOnPrimary} />
                </View>
              </AnimatedPressable>
            )}
            ListEmptyComponent={
              search ? (
                <View>
                  <EmptyState
                    icon={Icons.search}
                    title={`No results for "${search}"`}
                    subtitle="Add it yourself with the nutrition from the package or label."
                  />
                  <Button
                    title={`Add "${search}" as custom food`}
                    icon={Icons.add}
                    onPress={openCustomFood}
                    fullWidth
                    testID="add-custom-food"
                  />
                </View>
              ) : null
            }
          />
        </Animated.View>
      )}

      <Modal visible={customVisible} transparent animationType="slide" onRequestClose={() => setCustomVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.customSheet}>
            <View style={styles.customHeader}>
              <Text variant="subheading">Add custom food</Text>
              <AnimatedPressable onPress={() => setCustomVisible(false)} accessibilityLabel="Close custom food form">
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </AnimatedPressable>
            </View>
            <Input label="Food name" value={customName} onChangeText={setCustomName} autoCapitalize="sentences" />
            <View style={styles.nutritionGrid}>
              <Input label="Calories" value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" />
              <Input label="Protein (g)" value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" />
              <Input label="Carbs (g)" value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" />
              <Input label="Fat (g)" value={customFat} onChangeText={setCustomFat} keyboardType="numeric" />
            </View>
            <Button title="Add to meal" onPress={handleCustomLog} loading={logging} fullWidth />
          </View>
        </View>
      </Modal>

      <EditPortionSheet
        entry={editingEntry}
        food={pickingFood}
        onClose={() => {
          setEditingEntry(null);
          setPickingFood(null);
        }}
        onConfirm={async (quantity, servingUnit) => {
          if (pickingFood?.id) await handleManualLog(pickingFood.id, quantity, servingUnit);
        }}
        onSaved={() => {
          setEditingEntry(null);
          setPickingFood(null);
          refreshLogQueries();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  titleCase: {
    textTransform: 'capitalize',
  },

  scanRow: {
    marginBottom: Spacing.lg,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scanButton: {
    flex: 1,
  },
  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scanningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scanThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardMid,
  },
  scanningInfo: {
    flex: 1,
    gap: 2,
  },
  pulseBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
  },
  searchAction: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },

  listWrap: {
    flex: 1,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  existingSection: {
    marginBottom: Spacing.lg,
  },
  existingTitle: {
    marginBottom: Spacing.sm,
  },
  existingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  existingItemInfo: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.md,
  },
  entryAction: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  foodInfo: {
    flex: 1,
    gap: 3,
    paddingRight: Spacing.md,
  },
  foodBrand: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm - 2,
    marginTop: 2,
  },
  macroDot: {
    width: 3,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.textMuted,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  skeletonText: {
    flex: 1,
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  customSheet: {
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: 34,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
