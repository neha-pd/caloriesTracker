import { useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLogStore } from '../../store/logStore';
import api from '../api';

/** Largest single amount accepted from the custom input (ml). */
export const MAX_WATER_ADD_ML = 5000;
/** Daily total cap — the server stores water_ml as a SMALLINT. */
export const MAX_WATER_TOTAL_ML = 32767;

/**
 * Water logging logic, extracted from WaterTracker so the component stays
 * presentational: optimistic zustand update, PATCH, rollback on failure.
 * Resolves true when the amount was saved.
 */
export function useWater(waterMl: number, onUpdate: () => void) {
  const [updating, setUpdating] = useState(false);
  const setDashboard = useLogStore((s) => s.setDashboard);
  const queryClient = useQueryClient();

  /** Save today's total (ml). Used by both the custom add and the droplets. */
  const setWater = async (total: number): Promise<boolean> => {
    if (updating) return false;
    const newTotal = Math.min(MAX_WATER_TOTAL_ML, Math.max(0, Math.round(total)));
    if (newTotal === waterMl) return true;
    setUpdating(true);

    // Stop any in-flight dashboard fetch so it can't land after the optimistic
    // update and flash the old total back.
    await queryClient.cancelQueries({ queryKey: ['dashboard', 'today'] });

    // Snapshot via getState() so the rollback uses the value right before the
    // optimistic update, not a stale render-time closure.
    const snapshot = useLogStore.getState().dashboard;

    if (snapshot) {
      setDashboard({ ...snapshot, water_ml: newTotal });
    }

    try {
      await api.patch('/api/dashboard/water', { water_ml: newTotal });
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ['history'] });
      return true;
    } catch {
      if (snapshot) {
        setDashboard({ ...snapshot });
      }
      Alert.alert('Error', 'Could not update water intake.');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const addWater = (ml: number) => setWater(waterMl + ml);

  return { addWater, setWater, updating };
}
