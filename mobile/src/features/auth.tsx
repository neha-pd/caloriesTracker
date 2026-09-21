import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Art,
  Banner,
  Button,
  C,
  Card,
  Field,
  Meter,
  Page,
  S,
  Segments,
  T,
  Tap,
} from "./ui";
import { useAuthStore } from "../store/authStore";
import api, { errorMessage } from "../lib/api";
export function Welcome() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function demo() {
    setBusy(true);
    try {
      await useAuthStore.getState().enterDemo();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      eyebrow="FITLENS · LITTLE WINS, EVERY DAY"
      title={"Feel good.\nBuild your fire."}
      subtitle="A little awareness. A little consistency. A healthier rhythm that feels like you."
    >
      <Art size={270} />
      <Card>
        <T bold size={20}>
          Meet Ember. Your everyday spark.
        </T>
        <T color={C.muted}>
          Log a meal, sip some water, collect little wins. Your companion grows
          with your consistency.
        </T>
      </Card>
      <Button
        title="Start my journey"
        testID="start-journey"
        onPress={() => router.push("/(auth)/register")}
      />
      <Button
        title="I already have an account"
        secondary
        onPress={() => router.push("/(auth)/login")}
      />
      <Button
        title="Explore 45-day demo"
        secondary
        testID="enter-demo"
        loading={busy}
        onPress={() => void demo()}
      />
      {error && <Banner error text={error} />}
      <T size={12} color={C.muted} style={{ textAlign: "center" }}>
        Food logging works offline. Sync when you’re connected.
      </T>
    </Page>
  );
}
export function AuthForm({ register = false }: { register?: boolean }) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setError("");
    if (register && !name.trim()) {
      setError("Tell us what to call you.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setError(
        "Enter a valid email and a password with at least 8 characters.",
      );
      return;
    }
    setBusy(true);
    try {
      if (register)
        await useAuthStore
          .getState()
          .register(email.trim(), password, name.trim());
      else await useAuthStore.getState().login(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="YOUR NEXT CHAPTER"
      title={
        register ? "Small steps.\nBig energy." : "Welcome back,\nbright spark."
      }
      subtitle={
        register
          ? "Create your space for healthy habits."
          : "Your little wins are waiting for you."
      }
    >
      {register && (
        <Field
          label="Your name"
          value={name}
          onChange={setName}
          testID="auth-name"
        />
      )}
      <Field
        label="Email address"
        value={email}
        onChange={setEmail}
        keyboard="email-address"
        testID="auth-email"
      />
      <Field
        label="Password"
        value={password}
        onChange={setPassword}
        secure
        testID="auth-password"
      />
      {error && <Banner text={error} error />}
      <Button
        title={register ? "Create my account" : "Log in"}
        testID="auth-submit"
        onPress={() => void submit()}
        loading={busy}
      />
      {!register && (
        <Tap onPress={() => router.push("/(auth)/recovery")}>
          <T color={C.lime}>Forgot your password?</T>
        </Tap>
      )}
      <Button
        secondary
        title={
          register ? "Already a member? Log in" : "New here? Create an account"
        }
        onPress={() =>
          router.replace(register ? "/(auth)/login" : "/(auth)/register")
        }
      />
      <T color={C.muted} size={12}>
        Your account syncs confirmed logs. Meal photos stay on your device.
      </T>
    </Page>
  );
}
export function Recovery() {
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [stage, setStage] = useState(false),
    [linkSent, setLinkSent] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (stage) {
        await api.post("/api/auth/reset-password", { token, password });
        setMessage("Password updated. You can log in with your new password.");
      } else {
        const { data } = await api.post("/api/auth/forgot-password", { email });
        setLinkSent(data.mode === "email_link");
        setMessage(
          data.message ||
            "If this email has an account, a recovery email is on its way.",
        );
        setStage(data.mode !== "email_link");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      title="A fresh start."
      subtitle="We’ll email you instructions to reset your password."
    >
      {!stage ? (
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          keyboard="email-address"
        />
      ) : (
        <>
          <Field label="Recovery code" value={token} onChange={setToken} />
          <Field
            label="New password"
            value={password}
            onChange={setPassword}
            secure
          />
        </>
      )}
      {message && <Banner text={message} />}
      {error && <Banner text={error} error />}
      <Button
        title={
          stage
            ? "Set new password"
            : linkSent
              ? "Send email again"
              : "Send recovery email"
        }
        loading={busy}
        onPress={() => void submit()}
      />
      <Button
        secondary
        title="Back to login"
        onPress={() => router.replace("/(auth)/login")}
      />
    </Page>
  );
}
export function Goals({ onboarding = false }: { onboarding?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const [stage, setStage] = useState(0),
    [goal, setGoal] = useState(user?.goal_type || "maintain"),
    [cal, setCal] = useState(String(user?.calorie_goal || 2000)),
    [protein, setProtein] = useState(String(user?.protein_goal_g || 100)),
    [carbs, setCarbs] = useState(String(user?.carbs_goal_g || 250)),
    [fat, setFat] = useState(String(user?.fat_goal_g || 67)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch("/api/users/me/goals", {
        goal_type: goal,
        calorie_goal: Number(cal),
        protein_goal_g: Number(protein),
        carbs_goal_g: Number(carbs),
        fat_goal_g: Number(fat),
      });
      useAuthStore.getState().updateUser(data.user);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back={!onboarding}
      eyebrow={
        onboarding ? `MAKE IT YOURS · ${stage + 1} OF 2` : "YOUR DAILY TARGETS"
      }
      title={
        onboarding && stage === 0
          ? "What feels\nright for you?"
          : "Find your rhythm."
      }
      subtitle="Your goals can change with you. Choose targets that fit your own needs."
    >
      {onboarding && <Meter value={(stage + 1) * 50} />}
      {(!onboarding || stage === 0) && (
        <>
          {[
            {
              key: "maintain",
              title: "Feel balanced",
              body: "Build awareness and a steady routine.",
            },
            {
              key: "gain_muscle",
              title: "Build strength",
              body: "Fuel your activity and training.",
            },
            {
              key: "lose_weight",
              title: "Manage my weight",
              body: "Make thoughtful, sustainable choices.",
            },
          ].map((g) => (
            <Card
              key={g.key}
              onPress={() => setGoal(g.key)}
              style={{
                borderColor: goal === g.key ? C.lime : C.border,
                backgroundColor: goal === g.key ? C.elevated : C.card,
              }}
            >
              <T bold size={19}>
                {goal === g.key ? "●  " : "○  "}
                {g.title}
              </T>
              <T color={C.muted}>{g.body}</T>
            </Card>
          ))}
        </>
      )}
      {(!onboarding || stage === 1) && (
        <>
          <Card>
            <T bold>Set your daily targets</T>
            <T color={C.muted} size={13}>
              These are editable starting values, not a personalized nutrition
              prescription.
            </T>
            <Field
              label="Energy · kcal"
              value={cal}
              onChange={setCal}
              numeric
              testID="goal-calories"
            />
            <View style={S.two}>
              <Field
                label="Protein · g"
                value={protein}
                onChange={setProtein}
                numeric
              />
              <Field
                label="Carbs · g"
                value={carbs}
                onChange={setCarbs}
                numeric
              />
              <Field label="Fat · g" value={fat} onChange={setFat} numeric />
            </View>
          </Card>
          <Card>
            <T bold color={C.orange}>
              Consistency earns the rewards.
            </T>
            <T color={C.muted}>
              You earn XP for checking in, logging meals, and drinking water.
              Eating less never earns extra points.
            </T>
          </Card>
        </>
      )}
      {error && <Banner text={error} error />}
      <Button
        title={
          onboarding && stage === 0
            ? "Continue"
            : onboarding
              ? "Let’s meet Ember"
              : "Save targets"
        }
        testID="goals-submit"
        loading={busy}
        onPress={() => (onboarding && stage === 0 ? setStage(1) : void save())}
      />
      {onboarding && stage === 1 && (
        <Button
          secondary
          title="Back to my intention"
          onPress={() => setStage(0)}
        />
      )}
    </Page>
  );
}
