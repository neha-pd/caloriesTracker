import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { localDateKey } from './dates';

let BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) {
  // Automatically detect the dev machine's IP instead of localhost
  const hostUri = Constants?.expoConfig?.hostUri;
  if (hostUri) {
    BASE_URL = `http://${hostUri.split(':')[0]}:3000`;
  } else {
    // Android emulator cannot access localhost directly, use 10.0.2.2 instead
    if (Platform.OS === 'android') {
      BASE_URL = 'http://10.0.2.2:3000';
    } else {
      BASE_URL = 'http://localhost:3000';
    }
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request, plus the device's local calendar date so the
// server files "today" under the user's day rather than the UTC one.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Local-Date'] = localDateKey();
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await SecureStore.getItemAsync('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refresh });
        await SecureStore.setItemAsync('access_token', data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
