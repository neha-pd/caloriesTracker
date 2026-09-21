import React, {useState} from "react";
import {Banner, Button, Card, C, Field, Page, Segments, T} from "../ui";
import {useAuthStore} from "../../store/authStore";
import api, {errorMessage} from "../../lib/api";
export default function MovementGoals(){
  const u=useAuthStore(s=>s.user);
  const [steps, setSteps] = useState(u?.settings.step_goal?.toString() || ""),
    [move, setMove] = useState(u?.settings.move_goal_kcal?.toString() || ""),
    [minutes, setMinutes] = useState(
      u?.settings.exercise_goal_minutes?.toString() || "",
    ),
    [message, setMessage] = useState("");
  async function saveGoals() {
    try {
      const goals = {
        step_goal: steps ? Number(steps) : null,
        move_goal_kcal: move ? Number(move) : null,
        exercise_goal_minutes: minutes ? Number(minutes) : null,
      };
      if (
        (steps &&
          (!Number.isInteger(Number(steps)) ||
            Number(steps) < 500 ||
            Number(steps) > 60000)) ||
        (move &&
          (!Number.isInteger(goals.move_goal_kcal) ||
            Number(move) < 50 ||
            Number(move) > 3000)) ||
        (minutes &&
          (!Number.isInteger(goals.exercise_goal_minutes) ||
            Number(minutes) < 5 ||
            Number(minutes) > 300))
      )
        throw new Error(
          "Choose 500–60,000 steps, 50–3000 active kcal and 5–300 workout minutes, or leave blank.",
        );
      if (u?.id === "fitlens-offline-demo") {
        useAuthStore
          .getState()
          .updateUser({ settings: { ...u.settings, ...goals } });
        setMessage("Movement goals saved for this demo.");
        return;
      }
      const { data } = await api.patch("/api/users/me/settings", goals);
      useAuthStore
        .getState()
        .updateUser(
          data.user ? data.user : { settings: { ...u!.settings, ...goals } },
        );
      setMessage(
        "Movement goals saved. These do not increase your food allowance.",
      );
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
return <Page back title="Your daily goals" subtitle="Choose what works for your routine. Every goal is optional.">
      <Card>
        <T bold>How many steps feel right for you?</T>
        <T color={C.muted} size={12}>
          Choose a daily goal that fits your routine. You can change it anytime.
        </T>
        <Segments
          value={steps}
          onChange={setSteps}
          values={[
            { key: "3000", label: "3,000" },
            { key: "6000", label: "6,000" },
            { key: "10000", label: "10,000" },
          ]}
        />
        <Field
          label="Daily step goal · optional"
          value={steps}
          onChange={setSteps}
          numeric
        />
        <T bold>Optional movement goals</T>
        <Field
          label="Active kcal goal · optional"
          value={move}
          onChange={setMove}
          numeric
        />
        <Field
          label="Workout minutes goal · optional"
          value={minutes}
          onChange={setMinutes}
          numeric
        />
        <Button title="Save movement goals" onPress={() => void saveGoals()} />
        {!!message && <Banner text={message} />}
      </Card>
</Page>;
}
