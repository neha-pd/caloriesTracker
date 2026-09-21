import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/core/database.js";
import { createApp } from "../src/app.js";
import { localDay } from "../src/core/domain.js";
test("complete account lifecycle, isolation, idempotent logs, sync and recovery", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  const app = await createApp({
    db,
    secret: "integration-test-secret-at-least-32-characters",
    testing: true,
  });
  await app.ready();
  async function call(method: any, url: string, payload?: any, token?: string) {
    const r = await app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: r.statusCode, body: r.json() };
  }
  try {
    const reg = await call("POST", "/api/auth/register", {
      email: "Test@Example.com",
      password: "Secure-pass-123",
      display_name: "Neha",
      timezone: "Asia/Kolkata",
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    let token = reg.body.token;
    const refresh = reg.body.refresh_token;
    assert.equal(reg.body.user.email, "test@example.com");
    assert.equal(reg.body.user.password_hash, undefined);
    assert.equal(
      (
        await call("POST", "/api/auth/register", {
          email: "test@example.com",
          password: "Secure-pass-123",
          display_name: "Other",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("POST", "/api/auth/login", {
          email: "test@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal((await call("GET", "/api/users/me")).status, 401);
    const goals = await call(
      "PATCH",
      "/api/users/me/goals",
      {
        goal_type: "maintain",
        calorie_goal: 2100,
        protein_goal_g: 120,
        carbs_goal_g: 250,
        fat_goal_g: 70,
      },
      token,
    );
    assert.equal(goals.status, 200);
    assert.equal(goals.body.user.onboarding_complete, true);
    const profile = await call(
      "PATCH",
      "/api/users/me",
      { weight_kg: 72, weight_goal_kg: 68 },
      token,
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.weight_goal_kg, 68);
    assert.equal(
      (await call("PATCH", "/api/users/me", { weight_goal_kg: -5 }, token))
        .status,
      400,
    );
    const today = localDay("Asia/Kolkata"),
      id = randomUUID();
    const base = {
      calories: 100,
      protein_g: 5,
      carbs_g: 10,
      fat_g: 4,
      fiber_g: 2,
    };
    const body = {
      id,
      log_date: today,
      name: "Test oats",
      meal_type: "breakfast",
      quantity: 2,
      serving_unit: "100 g",
      ...base,
      base_nutrition: base,
      source: "manual",
    };
    const meal = await call("PUT", `/api/v2/entries/${id}`, body, token);
    assert.equal(meal.status, 200, JSON.stringify(meal.body));
    assert.equal(meal.body.entry.calories, 200);
    assert.equal(meal.body.awarded_xp, 35);
    assert.equal(
      (await call("PUT", `/api/v2/entries/${id}`, body, token)).body.awarded_xp,
      0,
    );
    const other = await call("POST", "/api/auth/register", {
      email: "other@example.com",
      password: "Secure-pass-123",
      display_name: "Other",
    });
    assert.equal(
      (await call("PUT", `/api/v2/entries/${id}`, body, other.body.token))
        .status,
      409,
    );
    assert.equal(
      (await call("GET", "/api/v2/changes", undefined, other.body.token)).body
        .entries.length,
      0,
    );
    assert.equal(
      (
        await call(
          "PATCH",
          `/api/v2/entries/${id}`,
          { quantity: 3, meal_type: "breakfast", version: 1 },
          token,
        )
      ).body.entry.calories,
      300,
    );
    assert.equal(
      (
        await call(
          "PATCH",
          `/api/v2/entries/${id}`,
          { quantity: 4, meal_type: "breakfast", version: 1 },
          token,
        )
      ).status,
      409,
    );
    const wid = randomUUID();
    assert.equal(
      (
        await call(
          "PUT",
          `/api/v2/water/${wid}`,
          { log_date: today, amount_ml: 250 },
          token,
        )
      ).body.awarded_xp,
      15,
    );
    await call(
      "PUT",
      `/api/v2/water/${wid}`,
      { log_date: today, amount_ml: 250 },
      token,
    );
    assert.equal(
      (await call("POST", "/api/v2/check-in", {}, token)).body.awarded_xp,
      10,
    );
    assert.equal(
      (await call("POST", "/api/v2/check-in", {}, token)).body.awarded_xp,
      0,
    );
    const day = await call(
      "GET",
      "/api/v2/day?date=" + today,
      undefined,
      token,
    );
    assert.equal(day.body.water_ml, 250);
    assert.equal(day.body.consumed.calories, 300);
    assert.equal(
      (await call("GET", "/api/v2/progress", undefined, token)).body.xp,
      60,
    );
    await call("DELETE", `/api/v2/entries/${id}`, undefined, token);
    assert.ok(
      (await call("GET", "/api/v2/changes", undefined, token)).body.entries[0]
        .deleted_at,
    );
    assert.equal(
      (await call("GET", "/api/v2/day?date=" + today, undefined, token)).body
        .entries.length,
      0,
    );
    const rotated = await call("POST", "/api/auth/refresh", {
      refresh_token: refresh,
    });
    assert.equal(rotated.status, 200);
    assert.equal(
      (await call("POST", "/api/auth/refresh", { refresh_token: refresh }))
        .status,
      401,
    );
    token = rotated.body.token;
    const recovery = await call("POST", "/api/auth/forgot-password", {
      email: "test@example.com",
    });
    assert.ok(recovery.body.development_token);
    assert.equal(
      (
        await call("POST", "/api/auth/reset-password", {
          token: recovery.body.development_token,
          password: "Changed-pass-123",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("GET", "/api/users/me", undefined, token)).status,
      401,
    );
    assert.equal(
      (
        await call("POST", "/api/auth/reset-password", {
          token: recovery.body.development_token,
          password: "Again-pass-123",
        })
      ).status,
      400,
    );
    const login = await call("POST", "/api/auth/login", {
      email: "test@example.com",
      password: "Changed-pass-123",
    });
    assert.equal(login.status, 200);
    token = login.body.token;
    assert.equal(
      (await call("GET", "/api/users/me/export", undefined, token)).body.water
        .length,
      1,
    );
    await call("DELETE", "/api/auth/logout", undefined, token);
    assert.equal(
      (await call("GET", "/api/users/me", undefined, token)).status,
      401,
    );
    assert.equal(
      (
        await call("POST", "/api/auth/refresh", {
          refresh_token: login.body.refresh_token,
        })
      ).status,
      401,
    );
    token = (
      await call("POST", "/api/auth/login", {
        email: "test@example.com",
        password: "Changed-pass-123",
      })
    ).body.token;
    assert.equal(
      (await call("DELETE", "/api/users/me", { password: "wrong" }, token))
        .status,
      401,
    );
    assert.equal(
      (
        await call(
          "DELETE",
          "/api/users/me",
          { password: "Changed-pass-123" },
          token,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call("POST", "/api/auth/login", {
          email: "test@example.com",
          password: "Changed-pass-123",
        })
      ).status,
      401,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
