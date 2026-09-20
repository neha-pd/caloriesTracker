import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

// WebBrowser is required for AuthSession to work
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Google Cloud Console Credentials configuration
// console.cloud.google.com -> APIs & Services -> Credentials

// 1. Web Client ID (used for all platforms as fallback in Expo Go)
const CLIENT_ID_WEB = '800988812109-uu7stnb6k7cjak7v3uaopskjpuejomvq.apps.googleusercontent.com';

// 2. iOS Client ID (optional — Create a native iOS OAuth Client ID with bundle identifier: com.fitlens.app)
const CLIENT_ID_IOS = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

// 3. Android Client ID (optional — Create a native Android OAuth Client ID with package: com.fitlens.app + SHA-1)
const CLIENT_ID_ANDROID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

// Whether a native client ID is configured for the current platform
const hasNativeAndroidClientId = !CLIENT_ID_ANDROID.includes('YOUR_ANDROID_CLIENT_ID');
const hasNativeIosClientId = !CLIENT_ID_IOS.includes('YOUR_IOS_CLIENT_ID');

/**
 * Terminate any auth session that is still marked active — a dismissed or
 * abandoned browser sheet can leave one behind, after which every new
 * promptAsync warns "Only one AuthSession can be active" and does nothing.
 */
function dismissStaleAuthSessions() {
  try {
    WebBrowser.dismissAuthSession();
  } catch {}
  try {
    (AuthSession as any).dismiss?.();
  } catch {}
}

export function GoogleLoginButton({ action = 'continue' }: { action?: 'login' | 'register' | 'continue' }) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [loading, setLoading] = useState(false);
  const [authInFlight, setAuthInFlight] = useState(false);

  // In Expo Go, expo-auth-session v7 no longer auto-generates the proxy URL via
  // makeRedirectUri({ scheme }). We must construct it explicitly so that Google
  // Cloud Console can whitelist it as an Authorized Redirect URI.
  // Format: https://auth.expo.io/@<expo-username>/<app-slug>
  const EXPO_PROXY_REDIRECT_URI = 'https://auth.expo.io/@fitlens/fitlens';

  // Set up the Auth Request using the Expo proxy redirect URI.
  // This allows the Web Client ID to handle OAuth in Expo Go without
  // requiring a native Android/iOS OAuth client ID.
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID_WEB,
      // iosClientId/androidClientId are consumed by the Google provider flow but
      // are not declared on AuthRequestConfig, hence the cast below.
      iosClientId: hasNativeIosClientId ? CLIENT_ID_IOS : undefined,
      androidClientId: hasNativeAndroidClientId ? CLIENT_ID_ANDROID : undefined,
      redirectUri: EXPO_PROXY_REDIRECT_URI,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false, // PKCE is not supported with implicit flow (id_token)
      scopes: ['openid', 'profile', 'email'],
      extraParams: {
        nonce: Math.random().toString(36).substring(2),
      },
    } as AuthSession.AuthRequestConfig,
    { authorizationEndpoint: GOOGLE_AUTH_ENDPOINT }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { params } = response;
      if (params.id_token) {
        handleGoogleCallback(params.id_token);
      }
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign In Error', response.error?.message || 'Something went wrong');
    }
  }, [response]);

  const handleGoogleCallback = async (idToken: string) => {
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      // The router redirect is handled globally by _layout.tsx based on isLoggedIn state
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        'Authentication Failed',
        error?.response?.data?.error || 'Could not verify Google account.'
      );
    } finally {
      setLoading(false);
    }
  };

  // A session left active by an unmounted screen would block future attempts.
  useEffect(() => dismissStaleAuthSessions, []);

  const handlePress = async () => {
    if (!request || authInFlight) return;

    setAuthInFlight(true);
    try {
      // Clear any session a previous abandoned attempt left active.
      dismissStaleAuthSessions();
      await promptAsync();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not open Google Sign In');
    } finally {
      setAuthInFlight(false);
    }
  };

  const label = action === 'continue' ? 'Continue with Google'
    : action === 'login' ? 'Sign in with Google'
      : 'Sign up with Google';

  return (
    <Button
      title={label}
      onPress={handlePress}
      variant="secondary"
      icon="logo-google"
      fullWidth
      loading={loading || authInFlight}
      disabled={!request || authInFlight}
    />
  );
}
