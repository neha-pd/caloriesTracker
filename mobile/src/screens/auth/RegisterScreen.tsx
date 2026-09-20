import React, { useMemo, useState } from 'react';
import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AnimatedPressable, Button, Card, Input, Screen, Text } from '@/components/ui';
import { Colors, Motion, Spacing } from '@/constants/theme';
import { Icons } from '@/constants/icons';
import { useAuthStore } from '@/store/authStore';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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

  const handleRegister = async () => {
    if (!email || !password)
      return Alert.alert('Missing fields', 'Email and password are required.');
    if (password.length < 8)
      return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      // Go to onboarding wizard (profile setup)
      router.replace('/onboarding');
    } catch (err: any) {
      Alert.alert('Registration failed', err?.response?.data?.error ?? 'Something went wrong.');
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
        <Text variant="body">Start your nutrition journey today</Text>
      </Animated.View>

      {/* Form card */}
      <Card style={styles.card}>
        <Animated.View entering={enter.sections[0]} style={styles.titleBlock}>
          <Text variant="title">Create Account</Text>
          <Text variant="body">It only takes a minute</Text>
        </Animated.View>

        <Animated.View entering={enter.sections[1]} style={styles.fields}>
          <Input
            label="Display Name (optional)"
            icon={Icons.person}
            placeholder="e.g. Neha"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
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
            label="Password (min 8 chars)"
            icon={Icons.lock}
            secure
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
        </Animated.View>

        <Animated.View entering={enter.sections[2]}>
          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            testID="register-submit"
          />
        </Animated.View>

        <Animated.View entering={enter.sections[3]} style={styles.altAuth}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text variant="caption">OR</Text>
            <View style={styles.divider} />
          </View>
          <GoogleLoginButton action="register" />
        </Animated.View>

        <Animated.View entering={enter.sections[4]} style={styles.footer}>
          <Text variant="body">{'Already have an account? '}</Text>
          <AnimatedPressable onPress={() => router.back()} haptic="selection">
            <Text variant="body" weight="bold" color={Colors.primary}>
              Sign In
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
