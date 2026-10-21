import { InstallCard } from "./pwa";
import { calculateGoals, goalsSchema } from "../../../shared/nutrition";
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
      eyebrow="FITKIN · LITTLE WINS, EVERY DAY"
      title={"Feel good.\nBuild your fire."}
      subtitle="A little awareness. A little consistency. A healthier rhythm that feels like you."
    >
      <InstallCard />
      <Art size={270} />
      <Card>
        <T bold size={20}>
          Meet Kin. Your everyday fitness buddy.
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
      <Button
        title="Build my workout plan"
        secondary
        testID="welcome-train"
        onPress={() => router.push("/train")}
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
  const [stage, setStage] = useState(onboarding ? 0 : 1),
    [goal, setGoal] = useState(user?.goal_type || "maintain"),
    [age, setAge] = useState(user?.age ? String(user.age) : ""),
    [gender, setGender] = useState(user?.gender || ""),
    [height, setHeight] = useState(
      user?.height_cm ? String(user.height_cm) : "",
    ),
    [weight, setWeight] = useState(
      user?.weight_kg ? String(user.weight_kg) : "",
    ),
    [targetWeight, setTargetWeight] = useState(
      user?.weight_goal_kg
        ? String(user.weight_goal_kg)
        : user?.weight_kg
          ? String(user.weight_kg)
          : "",
    ),
    [activity, setActivity] = useState(user?.activity_level || ""),
    [calculatedUser, setCalculatedUser] = useState<typeof user>(null),
    [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const input = goalsSchema.parse({
        goal_type: goal,
        age: Number(age),
        gender,
        height_cm: Number(height),
        weight_kg: Number(weight),
        weight_goal_kg: Number(targetWeight),
        activity_level: activity,
      });
      const targets = calculateGoals(input);
      setCalculatedUser({ ...user!, ...input, ...targets });
      setMaintenanceCalories(targets.maintenance_calories);
      setStage(2);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirmTargets() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch("/api/users/me/goals", {
        goal_type: goal,
        age: Number(age),
        gender,
        height_cm: Number(height),
        weight_kg: Number(weight),
        weight_goal_kg: Number(targetWeight),
        activity_level: activity,
      });
      useAuthStore.getState().updateUser(data.user);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const editingDetails = stage < 2;
  return (
    <Page
      back={!onboarding}
      eyebrow={
        onboarding
          ? `MAKE IT YOURS · ${stage === 0 ? 1 : 2} OF 2`
          : "YOUR DAILY TARGETS"
      }
      title={
        onboarding && stage === 0
          ? "What feels\nright for you?"
          : stage === 2
            ? "Your starting targets."
            : "Find your rhythm."
      }
      subtitle={
        stage === 2
          ? "These are estimates to help you get started. You can revisit your details and targets anytime."
          : "Your goals can change with you. Choose targets that fit your own needs."
      }
    >
      {onboarding && <Meter value={stage === 0 ? 50 : 100} />}
      {editingDetails && (!onboarding || stage === 0) && (
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
              body: "Choose a target weight and build sustainable habits.",
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
      {editingDetails && (!onboarding || stage === 1) && (
        <>
          <Card>
            <T bold>Tell us about you</T>
            <T color={C.muted} size={13}>
              We use these details to estimate your daily energy and macro
              targets. Your target weight helps guide weight-management goals.
            </T>
            <Field
              label="Age · years (18+)"
              value={age}
              onChange={setAge}
              numeric
              testID="goal-age"
            />
            <View style={S.two}>
              <Field
                label="Height · cm"
                value={height}
                onChange={setHeight}
                numeric
                testID="goal-height"
              />
              <Field
                label="Current weight · kg"
                value={weight}
                onChange={setWeight}
                numeric
                testID="goal-current-weight"
              />
            </View>
            <Field
              label="Target weight · kg"
              value={targetWeight}
              onChange={setTargetWeight}
              numeric
              testID="goal-target-weight"
            />
            <T color={C.muted} size={13}>
              Gender for the energy estimate
            </T>
            <Segments
              value={gender}
              onChange={setGender}
              values={[
                { key: "female", label: "Female" },
                { key: "male", label: "Male" },
                { key: "other", label: "Other" },
                { key: "prefer_not_to_say", label: "Prefer not" },
              ]}
            />
            <T color={C.muted} size={13}>
              Usual activity level
            </T>
            <Segments
              value={activity}
              onChange={setActivity}
              values={[
                { key: "sedentary", label: "Sedentary" },
                { key: "lightly_active", label: "Light" },
                { key: "moderately_active", label: "Moderate" },
              ]}
            />
            <Segments
              value={activity}
              onChange={setActivity}
              values={[
                { key: "very_active", label: "Very active" },
                { key: "extra_active", label: "Extra active" },
              ]}
            />
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
      {stage === 2 && calculatedUser && maintenanceCalories !== null && (
        <>
          <Card>
            <T bold>Estimated daily targets</T>
            <View style={{ gap: 4 }}>
              <T color={C.muted}>Estimated maintenance · kcal</T>
              <T bold size={20}>
                {maintenanceCalories}
              </T>
            </View>
            <View style={{ gap: 4 }}>
              <T color={C.muted}>
                {maintenanceCalories > calculatedUser.calorie_goal
                  ? "Daily calorie deficit"
                  : maintenanceCalories < calculatedUser.calorie_goal
                    ? "Daily calorie surplus"
                    : "Daily calorie adjustment"}
              </T>
              <T bold size={18}>
                {Math.abs(maintenanceCalories - calculatedUser.calorie_goal)}{" "}
                kcal
              </T>
            </View>
            <View style={{ gap: 4 }}>
              <T color={C.muted}>Daily calorie target · kcal</T>
              <T bold size={24}>
                {calculatedUser.calorie_goal}
              </T>
            </View>
            <View style={[S.row, { justifyContent: "space-between" }]}>
              {[
                ["Protein · g", calculatedUser.protein_goal_g],
                ["Carbs · g", calculatedUser.carbs_goal_g],
                ["Fat · g", calculatedUser.fat_goal_g],
              ].map(([label, value]) => (
                <View key={String(label)} style={{ gap: 4 }}>
                  <T color={C.muted} size={13}>
                    {label}
                  </T>
                  <T bold size={18}>
                    {value}
                  </T>
                </View>
              ))}
            </View>
            <T color={C.muted} size={13}>
              For weight management, your target weight guides the calorie
              adjustment and is saved for progress tracking. Estimates use your
              current weight, age, height, gender, activity, and goal. These are
              general estimates, not a medical nutrition prescription.
            </T>
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
          <Button
            secondary
            title="Change my details"
            onPress={() => {
              setCalculatedUser(null);
              setMaintenanceCalories(null);
              setStage(1);
            }}
          />
        </>
      )}
      {error && <Banner text={error} error />}
      <Button
        title={
          stage === 0
            ? "Continue"
            : stage === 1
              ? "Calculate my targets"
              : onboarding
                ? "Let’s meet Kin"
                : "Save targets"
        }
        testID="goals-submit"
        loading={busy}
        onPress={() => {
          if (stage === 0) setStage(1);
          else if (stage === 1) void save();
          else void confirmTargets();
        }}
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
