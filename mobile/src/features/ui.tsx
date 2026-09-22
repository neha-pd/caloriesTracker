import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../store/authStore";
export const C = {
  bg: "#101211",
  card: "#1b1e1b",
  elevated: "#252c20",
  border: "#35402b",
  lime: "#d1fa70",
  orange: "#ff9f68",
  blue: "#8ecfea",
  purple: "#c4b4f9",
  text: "#f4f5ef",
  muted: "#a2a99e",
  danger: "#ffb2a1",
};
export const assets = {
  ember: require("../../assets/design/kin.png"),
  badge: require("../../assets/design/achievement.png"),
};
export function T({
  children,
  size = 15,
  color = C.text,
  bold = false,
  style,
  testID,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <Text
      testID={testID}
      style={[
        {
          fontFamily: bold ? "Manrope_800ExtraBold" : "DMSans_400Regular",
          fontSize: size,
          lineHeight: size * 1.45,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  color = C.lime,
  size = 22,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color?: string;
  size?: number;
}) {
  return <Ionicons name={name} color={color} size={size} />;
}
export function Tap({
  children,
  onPress,
  style,
  label,
  testID,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={() => {
        if (
          Platform.OS !== "web" &&
          useAuthStore.getState().user?.settings.haptics !== false
        )
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        style,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  loading = false,
  testID,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  loading?: boolean;
  testID?: string;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Tap
      label={title}
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        S.button,
        {
          backgroundColor: danger ? "#412a24" : secondary ? C.elevated : C.lime,
          borderColor: secondary ? C.border : "transparent",
          borderWidth: 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? C.lime : C.bg} />
      ) : (
        <>
          {icon && (
            <Icon name={icon} color={secondary ? C.lime : C.bg} size={19} />
          )}
          <T
            bold
            size={14}
            color={danger ? C.danger : secondary ? C.text : C.bg}
          >
            {title}
          </T>
        </>
      )}
    </Tap>
  );
}
export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  back = false,
  right,
  refresh,
  testID,
  scrollRef,
  onContentSizeChange,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  back?: boolean;
  right?: React.ReactNode;
  refresh?: { loading: boolean; run: () => void };
  scrollRef?: React.RefObject<ScrollView | null>;
  onContentSizeChange?: (width: number, height: number) => void;
  testID?: string;
}) {
  return (
    <SafeAreaView
      style={S.safe}
      edges={["top", "left", "right"]}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={onContentSizeChange}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.page}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refresh.loading}
                onRefresh={refresh.run}
                tintColor={C.lime}
              />
            ) : undefined
          }
        >
          {back && (
            <View style={[S.row, { marginBottom: 22 }]}>
              <Tap
                label="Go back"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(tabs)/dashboard")
                }
                style={S.round}
              >
                <Icon name="arrow-back" color={C.text} />
              </Tap>
              <View style={{ flex: 1 }} />
              {right ??
                (useAuthStore.getState().user?.onboarding_complete ? (
                  <Tap
                    label="Go home"
                    onPress={() => router.dismissTo("/(tabs)/dashboard")}
                    style={S.round}
                  >
                    <Icon name="home-outline" />
                  </Tap>
                ) : null)}
            </View>
          )}
          {eyebrow && (
            <T
              size={11}
              bold
              color={C.lime}
              style={{ letterSpacing: 1.6, marginBottom: 9 }}
            >
              {eyebrow.toUpperCase()}
            </T>
          )}
          {title && (
            <View style={[S.row, { alignItems: "flex-start" }]}>
              <T
                size={32}
                bold
                style={{ letterSpacing: -1.1, flex: 1, lineHeight: 38 }}
              >
                {title}
              </T>
              {!back && right}
            </View>
          )}
          {subtitle && (
            <T color={C.muted} style={{ marginTop: 12 }}>
              {subtitle}
            </T>
          )}
          <View style={{ gap: 16, marginTop: title ? 24 : 0 }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  return onPress ? (
    <Tap onPress={onPress} style={[S.card, style]}>
      {children}
    </Tap>
  ) : (
    <View style={[S.card, style]}>{children}</View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[S.row, { justifyContent: "space-between", marginTop: 7 }]}>
      <T bold size={17}>
        {title}
      </T>
      {action && onPress && (
        <Tap
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <T size={13} color={C.lime}>
            {action} ›
          </T>
        </Tap>
      )}
    </View>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure = false,
  numeric = false,
  testID,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  numeric?: boolean;
  testID?: string;
  placeholder?: string;
  keyboard?: React.ComponentProps<typeof TextInput>["keyboardType"];
}) {
  const [hidden, setHidden] = React.useState(secure);
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <T size={13} color={C.muted}>
        {label}
      </T>
      <View style={S.inputRow}>
        <TextInput
          accessibilityLabel={label}
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#77896b"
          secureTextEntry={hidden}
          keyboardType={numeric ? "decimal-pad" : keyboard}
          autoCapitalize={
            secure || keyboard === "email-address" ? "none" : "sentences"
          }
          autoCorrect={!secure && keyboard !== "email-address"}
          style={S.input}
        />
        {secure && (
          <Tap
            label={hidden ? "Show password" : "Hide password"}
            onPress={() => setHidden(!hidden)}
            style={{ padding: 12 }}
          >
            <Icon
              name={hidden ? "eye-outline" : "eye-off-outline"}
              color={C.muted}
              size={20}
            />
          </Tap>
        )}
      </View>
    </View>
  );
}
export function Segments({
  values,
  value,
  onChange,
}: {
  values: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={S.segments}>
      {values.map((v) => (
        <Tap
          key={v.key}
          label={v.label}
          onPress={() => onChange(v.key)}
          style={[S.segment, value === v.key && { backgroundColor: "#3c4b2d" }]}
        >
          <T
            size={12}
            bold={value === v.key}
            color={value === v.key ? C.lime : C.muted}
          >
            {v.label}
          </T>
        </Tap>
      ))}
    </View>
  );
}
export function Meter({
  value,
  color = C.lime,
}: {
  value: number;
  color?: string;
}) {
  return (
    <View
      style={{
        height: 5,
        backgroundColor: "#38432e",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 5,
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
export function Art({
  kind = "ember",
  size = 180,
}: {
  kind?: keyof typeof assets;
  size?: number;
}) {
  return (
    <Image
      source={assets[kind]}
      style={{
        width: size,
        height: size,
        alignSelf: "center",
        borderRadius: 24,
      }}
      accessibilityLabel={
        kind === "ember"
          ? "Kin, your fitness companion"
          : "Collectible achievement medallion"
      }
    />
  );
}
export function Banner({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 13,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: error ? "#78503b" : C.border,
        backgroundColor: error ? "#32241d" : "#23301b",
      }}
    >
      <T size={13} color={error ? C.danger : C.lime}>
        {text}
      </T>
    </View>
  );
}
export function Empty({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Card>
      <Art size={110} />
      <T bold size={21} style={{ textAlign: "center" }}>
        {title}
      </T>
      <T color={C.muted} style={{ textAlign: "center", marginVertical: 14 }}>
        {body}
      </T>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </Card>
  );
}
export function RowLink({
  title,
  subtitle,
  icon = "chevron-forward",
  onPress,
  value,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  value?: string;
}) {
  return (
    <Tap
      onPress={onPress}
      label={title}
      style={[
        S.row,
        {
          paddingVertical: 17,
          borderBottomWidth: 1,
          borderColor: C.border,
          minHeight: 60,
        },
      ]}
    >
      <Icon name={icon} />
      <View style={{ flex: 1 }}>
        <T size={15}>{title}</T>
        {subtitle && (
          <T size={12} color={C.muted}>
            {subtitle}
          </T>
        )}
      </View>
      {value && (
        <T size={13} color={C.muted}>
          {value}
        </T>
      )}
      <Icon name="chevron-forward" size={16} color={C.muted} />
    </Tap>
  );
}
export const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: {
    padding: 24,
    paddingBottom: 125,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  two: { flexDirection: "row", gap: 12 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 21,
    padding: 19,
    gap: 10,
  },
  button: {
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  round: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#455235",
    backgroundColor: "#1d2319",
    minHeight: 52,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: C.text,
  },
  segments: {
    flexDirection: "row",
    gap: 3,
    padding: 4,
    borderRadius: 13,
    backgroundColor: "#1d2319",
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderRadius: 9,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
});
