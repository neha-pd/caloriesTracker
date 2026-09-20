import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';

interface User {
  id:             string;
  email:          string;
  display_name:   string | null;
  calorie_goal:   number;
  protein_goal_g: number;
  carbs_goal_g:   number;
  fat_goal_g:     number;
  goal_type:      string | null;
  // Physical profile
  age:            number | null;
  gender:         string | null;
  height_cm:      number | null;
  weight_kg:      number | null;
  activity_level: string | null;
}

interface AuthState {
  user:         User | null;
  isLoading:    boolean;
  isLoggedIn:   boolean;
  login:        (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register:     (email: string, password: string, name?: string) => Promise<void>;
  logout:       () => Promise<void>;
  loadSession:  () => Promise<void>;
  refreshUser:  () => Promise<void>;
  updateUser:   (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:       null,
  isLoading:  true,
  isLoggedIn: false,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        set({ isLoading: false, isLoggedIn: false });
        return;
      }
      const { data } = await api.get('/api/users/me');
      set({ user: data.user, isLoggedIn: true, isLoading: false });
    } catch {
      set({ isLoggedIn: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    await SecureStore.setItemAsync('access_token', data.token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    set({ user: data.user, isLoggedIn: true });
  },

  loginWithGoogle: async (idToken: string) => {
    const { data } = await api.post('/api/auth/google', { id_token: idToken });
    await SecureStore.setItemAsync('access_token', data.token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    set({ user: data.user, isLoggedIn: true });
  },

  register: async (email, password, name) => {
    const { data } = await api.post('/api/auth/register', {
      email, password, display_name: name,
    });
    await SecureStore.setItemAsync('access_token', data.token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    set({ user: data.user, isLoggedIn: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, isLoggedIn: false });
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/api/users/me');
      set({ user: data.user });
    } catch {
      // silently fail — user will see stale data
    }
  },

  updateUser: (updates) =>
    set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
}));
