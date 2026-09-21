import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { openDatabase, migrate } from "../src/core/database.js";
import { localDay } from "../src/core/domain.js";
test("new foods earn per-entry XP, retries and edits do not, daily cap and account isolation hold", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  const app = await createApp({
    db,
    secret: "food-xp-test-secret-at-least-32-characters",
    testing: true,
  });
  try {
    const sign = async (email: string) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { email, password: "Strong-pass-123", display_name: "XP" },
        })
      ).json();
    const a = await sign("xp-a@example.com"),
      b = await sign("xp-b@example.com"),
      headers = { authorization: "Bearer " + a.token };
    const payload = {
      log_date: localDay("UTC"),
      name: "Rice",
      meal_type: "lunch",
      quantity: 1,
      serving_unit: "100g",
      base_nutrition: { calories: 100, protein_g: 2, carbs_g: 20, fat_g: 1 },
      source: "manual",
    };
    const id = randomUUID();
    const put = async (id: string) =>
      (
        await app.inject({
          method: "PUT",
          url: "/api/v2/entries/" + id,
          headers,
          payload: {
            ...payload,
            id,
            calories: 100,
            protein_g: 2,
            carbs_g: 20,
            fat_g: 1,
          },
        })
      ).json();
    assert.equal((await put(id)).awarded_xp, 35);
    assert.equal((await put(id)).awarded_xp, 0);
    for (let i = 1; i < 21; i++)
      assert.equal((await put(randomUUID())).awarded_xp, i < 20 ? 10 : 0);
    const progress = (
      await app.inject({ method: "GET", url: "/api/v2/progress", headers })
    ).json();
    assert.equal(progress.xp, 225);
    assert.equal(
      progress.today_events.keys.filter((k: string) => k.startsWith("food:"))
        .length,
      20,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v2/progress",
          headers: { authorization: "Bearer " + b.token },
        })
      ).json().xp,
      0,
    );
    const edit = await app.inject({
      method: "PATCH",
      url: "/api/v2/entries/" + id,
      headers,
      payload: { version: 1, quantity: 2, meal_type: "dinner" },
    });
    assert.equal(edit.statusCode, 200);
    assert.equal(
      (
        await app.inject({ method: "GET", url: "/api/v2/progress", headers })
      ).json().xp,
      225,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
