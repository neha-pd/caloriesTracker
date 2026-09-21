import test from "node:test";
import assert from "node:assert/strict";
import {
  foods,
  searchFoods,
  findFood,
} from "../../mobile/src/features/catalog";
import { xpReward, withXp, xpStreak } from "../../mobile/src/features/xp";
test("catalog retains original IDs, adds regional search and validates nutrition assumptions", () => {
  assert.ok(foods.length > 13000);
  assert.equal(new Set(foods.map((f) => f.id)).size, foods.length);
  for (const query of [
    "dosa",
    "डोसा",
    "தோசை",
    "poha",
    "rajma",
    "panner",
    "biriyani",
  ])
    assert.ok(searchFoods(query).length, query);
  assert.ok(searchFoods("poha", [], 30, "india").every((f) => f.indian));
  assert.equal(searchFoods("poha", [], 30, "saved").length, 0);
  for (const f of foods) {
    assert.ok(f.name);
    for (const k of ["calories", "protein_g", "carbs_g", "fat_g"] as const)
      assert.ok(Number.isFinite(f[k]) && f[k] >= 0, f.id + ":" + k);
    if (f.estimated) {
      assert.ok(f.recipe);
      assert.ok(f.recipe.yield_g > 0);
    }
  }
  assert.ok(findFood("2708347"));
  assert.equal(searchFoods("unfindable-food-zqx").length, 0);
});
test("XP is immediate, daily, bounded, idempotent and recalculates level and streak", () => {
  const today = "2026-09-21";
  const food = (id: string) => ({
    method: "put",
    url: "/api/v2/entries/" + id,
    body: { id, log_date: today, meal_type: "lunch" },
  });
  const first = xpReward(food("a"), [], today);
  assert.equal(first.amount, 35);
  assert.equal(xpReward(food("a"), first.keys, today).amount, 0);
  assert.equal(xpReward(food("b"), first.keys, today).amount, 10);
  assert.equal(
    xpReward(
      food("c"),
      ["meal:lunch", ...Array.from({ length: 20 }, (_, i) => "food:" + i)],
      today,
    ).amount,
    0,
  );
  assert.equal(
    xpReward({ ...food("a"), method: "patch" }, [], today).amount,
    0,
  );
  assert.equal(xpReward(food("a"), [], "2026-09-22").amount, 0);
  const p = withXp(
    {
      xp: 245,
      level: 1,
      progress: 245,
      next: 250,
      streak: 0,
      dates: [],
      badges: [],
    },
    10,
  );
  assert.equal(p.level, 2);
  assert.equal(p.progress, 5);
  assert.equal(xpStreak(["2026-09-19", "2026-09-20", "2026-09-21"], today), 3);
});
