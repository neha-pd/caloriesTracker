import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Screen chrome: safe area + bg + consistent padding. Every screen starts here. */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top'],
  keyboardAvoiding,
  refreshControl,
  contentStyle,
  testID,
}: Props) {
  let content: React.ReactNode;
  if (scroll) {
    content = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[padded && styles.padded, styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    );
  } else {
    content = <View style={[styles.flex, padded && styles.padded, contentStyle]}>{children}</View>;
  }

  if (keyboardAvoiding) {
    content = (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={edges} testID={testID}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.md,
  },
  scrollContent: {
    paddingBottom: 120, // clear the floating tab bar
  },
});
