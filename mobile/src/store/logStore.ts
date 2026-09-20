import { create } from 'zustand';
import { localDateKey } from '../lib/dates';

export interface LogEntry {
  id:                  string;
  meal_type:           'breakfast' | 'lunch' | 'dinner' | 'snack';
  status:              'pending' | 'processing' | 'complete' | 'failed' | 'manual';
  calories:            number | null;
  protein_g:           number | null;
  carbs_g:             number | null;
  fat_g:               number | null;
  food_name?:          string;
  image_url?:          string;
  ai_confidence?:      number;
  ai_identified_items?: any[];
  quantity:            number;
  serving_unit:        string;
  is_user_overridden:  boolean;
  logged_at:           string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** One logged food as it contributes to the day's totals. Null = no data. */
export interface DashboardEntry {
  id:           string;
  name:         string;
  quantity:     number;
  serving_unit: string;
  calories:     number | null;
  protein_g:    number | null;
  carbs_g:      number | null;
  fat_g:        number | null;
}

export interface DashboardMeal {
  calories:    number;
  protein_g:   number;
  carbs_g:     number;
  fat_g:       number;
  entry_count: number;
  item_names?: string[];
  entries?:    DashboardEntry[];
}

export interface MicronutrientTotal {
  label:             string;
  unit:              string;
  total:             number;
  entries_with_data: number;
}

export interface DashboardData {
  date:         string;
  goals:        { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed:     { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  remaining:    { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  percentage:   { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  meals:        Record<string, DashboardMeal>;
  micronutrients?: Record<string, MicronutrientTotal>;
  entry_count?: number;
  streak_days:  number;
  water_ml:     number;
}

interface LogState {
  entries:       LogEntry[];
  dashboard:     DashboardData | null;
  activeDate:    string;
  setEntries:    (entries: LogEntry[]) => void;
  addEntry:      (entry: LogEntry) => void;
  updateEntry:   (id: string, updates: Partial<LogEntry>) => void;
  removeEntry:   (id: string) => void;
  setDashboard:  (data: DashboardData) => void;
  setActiveDate: (date: string) => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries:    [],
  dashboard:  null,
  activeDate: localDateKey(),

  setEntries:    (entries)          => set({ entries }),
  addEntry:      (entry)            => set((s) => ({ entries: [...s.entries, entry] })),
  updateEntry:   (id, updates)      => set((s) => ({
    entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
  })),
  removeEntry:   (id)               => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  setDashboard:  (data)             => set({ dashboard: data }),
  setActiveDate: (date)             => set({ activeDate: date }),
}));
