import React, { useMemo, useState } from 'react';
import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AnimatedPressable, Button, Card, Input, Screen, Text } from '@/components/ui';
import { Colors, Motion, Spacing } from '@/constants/theme';
import { Icons } from '@/constants/icons';
import { useAuthStore } from '@/store/authStore';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  // Dev convenience: prefilled test account (full profile + goals seeded).
  // Clear these defaults before any production build.
  const [email, setEmail] = useState(__DEV__ ? 'test@fitlens.app' : '');
  const [password, setPassword] = useState(__DEV__ ? 'Test1234!' : '');
  const [loading, setLoading] = useState(false);

  // Entrance builders: 250ms fades, header first, then card sections staggered 50ms apart.
  const enter = useMemo(
    () => ({
      header: FadeInDown.duration(Motion.duration.base),
      sections: [0, 1, 2, 3, 4].map((i) =>
        FadeInUp.duration(Motion.duration.base).delay(50 + i * 50)
      ),
    }),
    []
  );

  const handleLogin = async () => {
    if (!email || !password)
      return Alert.alert('Missing fields', 'Please fill in all fields.');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.response?.data?.error ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboardAvoiding scroll edges={['top', 'bottom']} contentStyle={styles.content}>
      <StatusBar barStyle="light-content" />

      {/* App header */}
      <Animated.View entering={enter.header} style={styles.header}>
        <Text variant="hero">
          FitLens
          <Text variant="hero" color={Colors.primary}>
            .
          </Text>
        </Text>
        <Text variant="body">AI-powered nutrition tracking</Text>
      </Animated.View>

      {/* Form card */}
      <Card style={styles.card}>
        <Animated.View entering={enter.sections[0]} style={styles.titleBlock}>
          <Text variant="title">Welcome back</Text>
          <Text variant="body">Sign in to continue your journey</Text>
        </Animated.View>

        <Animated.View entering={enter.sections[1]} style={styles.fields}>
          <Input
            label="Email"
            icon={Icons.mail}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Input
            label="Password"
            icon={Icons.lock}
            secure
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </Animated.View>

        <Animated.View entering={enter.sections[2]}>
          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            testID="login-submit"
          />
        </Animated.View>

        <Animated.View entering={enter.sections[3]} style={styles.altAuth}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text variant="caption">OR</Text>
            <View style={styles.divider} />
          </View>
          <GoogleLoginButton action="login" />
        </Animated.View>

        <Animated.View entering={enter.sections[4]} style={styles.footer}>
          <Text variant="body">{"Don't have an account? "}</Text>
          <AnimatedPressable onPress={() => router.push('/register')} haptic="selection">
            <Text variant="body" weight="bold" color={Colors.primary}>
              Sign Up
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  card: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  titleBlock: {
    gap: Spacing.xs,
  },
  fields: {
    gap: Spacing.md,
  },
  altAuth: {
    gap: Spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderStrong,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
