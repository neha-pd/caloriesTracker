import React, { useMemo, useState, useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Banner,
  Button,
  C,
  Card,
  Field,
  Icon,
  Page,
  RowLink,
  S,
  Segments,
  T,
} from "./ui";
import { searchFoods, findFood, foods, indianFoodCount } from "./catalog";
import { useTracker } from "./tracker";
import type { Meal, Food } from "./types";
const meals = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];
export function LogFood() {
  const params = useLocalSearchParams<{
      meal?: string;
      query?: string;
      source?: string;
    }>(),
    s = useTracker();
  const [query, setQuery] = useState(params.query || ""),
    [meal, setMeal] = useState<Meal>((params.meal as Meal) || "lunch");
  const [scope, setScope] = useState<"all" | "india" | "saved">("all"),
    [limit, setLimit] = useState(30);
  useEffect(() => setLimit(30), [query, scope]);
  const results = useMemo(
    () => searchFoods(query, s.foods, limit + 1, scope),
    [query, s.foods, limit, scope],
  );
  return (
    <Page
      back
      eyebrow="MAKE A LITTLE NOTE"
      title="What’s on your plate?"
      subtitle="Search, choose your portion, and add. Your food library works offline."
    >
      <Segments
        values={meals}
        value={meal}
        onChange={(v) => setMeal(v as Meal)}
      />
      <Segments
        values={[
          { key: "all", label: "All foods" },
          { key: "india", label: "Indian" },
          { key: "saved", label: "My foods" },
        ]}
        value={scope}
        onChange={(v) => setScope(v as typeof scope)}
      />
      <Field
        label="Find a food"
        value={query}
        onChange={setQuery}
        placeholder="Try dosa, poha, roti, biryani…"
        testID="food-search"
      />
      <RowLink
        title="Create a custom food"
        subtitle="Use the nutrition label on your food"
        icon="add-circle-outline"
        onPress={() =>
          router.push({ pathname: "/food/custom", params: { meal } })
        }
      />
      <T size={12} color={C.muted}>
        {query
          ? `${Math.min(results.length, limit)}${results.length > limit ? "+" : ""} matches`
          : `${foods.length.toLocaleString()} foods · ${indianFoodCount} Indian entries`}{" "}
        · Offline library
      </T>
      {results.slice(0, limit).map((f) => (
        <Card
          key={f.id}
          onPress={() =>
            router.push({
              pathname: "/food/[id]",
              params: { id: f.id, meal, source: params.source || "catalog" },
            })
          }
        >
          <View style={S.row}>
            <Icon name="restaurant-outline" />
            <View style={{ flex: 1 }}>
              <T bold>{f.name}</T>
              <T size={12} color={C.muted}>
                {Math.round(f.calories)} kcal per {f.serving_qty}{" "}
                {f.serving_unit}
              </T>
              {f.estimated && (
                <T size={11} color={C.orange}>
                  Home-style recipe estimate
                </T>
              )}
            </View>
            <Icon name="add-circle" />
          </View>
        </Card>
      ))}
      {results.length > limit && (
        <Button
          secondary
          title="Show more foods"
          onPress={() => setLimit((v) => v + 30)}
        />
      )}
      <Button
        secondary
        title="Food sources & estimates"
        onPress={() => router.push("/food-sources")}
      />
      {results.length === 0 && (
        <T color={C.muted}>
          Try a simpler food name, or add the details from its label.
        </T>
      )}
    </Page>
  );
}
export function FoodDetail() {
  const {
      id,
      meal: initial,
      source,
    } = useLocalSearchParams<{ id: string; meal?: string; source?: string }>(),
    s = useTracker();
  const food = findFood(id, s.foods),
    [quantity, setQuantity] = useState("1"),
    [meal, setMeal] = useState<Meal>((initial as Meal) || "lunch"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!food)
    return (
      <Page back title="Food not found">
        <T color={C.muted}>Choose a food from your library to continue.</T>
        <Button title="Search foods" onPress={() => router.replace("/log")} />
      </Page>
    );
  const q = Number(quantity),
    portions = food.portions || [];
  async function add() {
    if (!Number.isFinite(q) || q <= 0 || q > 100) {
      setError("Choose a portion between 0 and 100 servings.");
      return;
    }
    setBusy(true);
    try {
      await s.addFood(
        food!,
        q,
        meal,
        source === "on_device"
          ? "on_device"
          : food!.source === "custom"
            ? "manual"
            : "catalog",
      );
      router.replace("/diary");
    } catch {
      setError("Could not save this entry. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="MAKE IT YOUR PORTION"
      title={food.name}
      subtitle={`${food.source || "Your custom food"} · values per ${food.serving_qty} ${food.serving_unit}`}
    >
      <Card>
        <T color={C.muted}>Your portion</T>
        <T bold size={42}>
          {Number.isFinite(q) ? Math.round(food.calories * q) : 0}{" "}
          <T size={18} color={C.muted}>
            kcal
          </T>
        </T>
        <View style={S.two}>
          {[
            ["Protein", food.protein_g, C.orange],
            ["Carbs", food.carbs_g, C.blue],
            ["Fat", food.fat_g, C.purple],
          ].map(([label, v, c]) => (
            <View key={String(label)} style={{ flex: 1 }}>
              <T color={String(c)} bold>
                {Number.isFinite(q) ? Math.round(Number(v) * q) : 0} g
              </T>
              <T size={12} color={C.muted}>
                {label}
              </T>
            </View>
          ))}
        </View>
      </Card>
      {food.estimated && (
        <Banner text="Recipe estimate: cooking oil, ingredient choices and water content change the values. Review the recipe assumptions below." />
      )}
      <Field
        label={`Servings · 1 = ${food.serving_qty} ${food.serving_unit}`}
        value={quantity}
        onChange={setQuantity}
        numeric
        testID="food-quantity"
      />
      {portions.length > 0 && (
        <Card>
          <T bold>Common portions</T>
          {portions.slice(0, 5).map((p, i) => (
            <RowLink
              key={i}
              title={p.label}
              value={`${p.grams} g`}
              onPress={() =>
                setQuantity(String(Math.round((p.grams / 100) * 1000) / 1000))
              }
            />
          ))}
        </Card>
      )}
      {food.recipe && (
        <Card>
          <T bold>Recipe assumptions · {food.recipe.yield_g} g cooked batch</T>
          <T size={12} color={C.muted}>
            {food.recipe.note}
          </T>
          {food.recipe.ingredients.map((i, n) => (
            <T size={12} key={n}>
              {i.grams} g · {i.name}
            </T>
          ))}
        </Card>
      )}
      <Segments
        values={meals}
        value={meal}
        onChange={(v) => setMeal(v as Meal)}
      />
      {error && <Banner error text={error} />}
      <Button
        title="Add to my diary"
        testID="food-confirm"
        onPress={() => void add()}
        loading={busy}
      />
      <T size={12} color={C.muted}>
        Food values are estimates. Confirm preparation and portion size before
        adding.
      </T>
    </Page>
  );
}
export function CustomFood() {
  const { meal } = useLocalSearchParams<{ meal?: string }>(),
    s = useTracker();
  const [name, setName] = useState(""),
    [unit, setUnit] = useState("serving"),
    [cal, setCal] = useState(""),
    [protein, setProtein] = useState(""),
    [carbs, setCarbs] = useState(""),
    [fat, setFat] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (
      !name.trim() ||
      !unit.trim() ||
      [cal, protein, carbs, fat].some(
        (v) => v.trim() === "" || !Number.isFinite(Number(v)) || Number(v) < 0,
      ) ||
      Number(cal) > 20000 ||
      Number(protein) > 2000 ||
      Number(carbs) > 5000 ||
      Number(fat) > 2000
    ) {
      setError(
        "Add a name, serving unit, and valid nutrition values from the label.",
      );
      return;
    }
    setBusy(true);
    const food: Food = {
      id: Crypto.randomUUID(),
      name: name.trim(),
      serving_qty: 1,
      serving_unit: unit.trim(),
      calories: Number(cal),
      protein_g: Number(protein),
      carbs_g: Number(carbs),
      fat_g: Number(fat),
      source: "custom",
    };
    try {
      await s.saveFood(food);
      router.replace({
        pathname: "/food/[id]",
        params: { id: food.id, meal: meal || "lunch" },
      });
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      back
      eyebrow="YOUR FOOD, YOUR DETAILS"
      title="Make it yours."
      subtitle="Enter the nutrition on your label for one serving."
    >
      <Field
        label="Food name"
        value={name}
        onChange={setName}
        testID="custom-name"
      />
      <Field
        label="One serving is…"
        value={unit}
        onChange={setUnit}
        placeholder="e.g. 1 bar (40 g)"
      />
      <Field
        label="Calories · kcal"
        value={cal}
        onChange={setCal}
        numeric
        testID="custom-calories"
      />
      <View style={S.two}>
        <Field
          label="Protein · g"
          value={protein}
          onChange={setProtein}
          numeric
          testID="custom-protein"
        />
        <Field
          label="Carbs · g"
          value={carbs}
          onChange={setCarbs}
          numeric
          testID="custom-carbs"
        />
        <Field
          label="Fat · g"
          value={fat}
          onChange={setFat}
          numeric
          testID="custom-fat"
        />
      </View>
      {error && <Banner error text={error} />}
      <Button
        title="Save food & choose portion"
        testID="custom-save"
        loading={busy}
        onPress={() => void save()}
      />
    </Page>
  );
}
export function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useTracker(),
    entry = s.entries.find((e) => e.id === id && !e.deleted_at);
  const [quantity, setQuantity] = useState(String(entry?.quantity || 1)),
    [meal, setMeal] = useState<Meal>(entry?.meal_type || "lunch"),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  if (!entry)
    return (
      <Page back title="Entry removed">
        <Button
          title="Back to diary"
          onPress={() => router.replace("/diary")}
        />
      </Page>
    );
  async function save() {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0 || q > 100) {
      setError("Enter a portion between 0 and 100 servings.");
      return;
    }
    await s.editEntry(id, q, meal);
    router.back();
  }
  return (
    <Page back eyebrow="TUNE YOUR FOOD DIARY" title={entry.name}>
      <Card>
        <T bold size={35}>
          {Math.round(entry.base_nutrition.calories * (Number(quantity) || 0))}{" "}
          kcal
        </T>
        <T color={C.muted}>
          {entry.log_date} · {entry.serving_unit}
        </T>
      </Card>
      <Field
        label="Servings"
        value={quantity}
        onChange={setQuantity}
        numeric
        testID="entry-quantity"
      />
      <Segments
        values={meals}
        value={meal}
        onChange={(v) => setMeal(v as Meal)}
      />
      {error && <Banner error text={error} />}
      <Button
        title="Save changes"
        testID="entry-save"
        onPress={() => void save()}
      />
      {confirm ? (
        <Card>
          <T>Remove this entry from your diary?</T>
          <Button
            danger
            title="Yes, remove entry"
            testID="entry-delete-confirm"
            onPress={() => {
              void s.deleteEntry(id);
              router.replace("/diary");
            }}
          />
          <Button
            secondary
            title="Keep entry"
            onPress={() => setConfirm(false)}
          />
        </Card>
      ) : (
        <Button
          secondary
          title="Remove entry"
          onPress={() => setConfirm(true)}
          testID="entry-delete"
        />
      )}
    </Page>
  );
}
