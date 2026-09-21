import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/core/database.js";
import { createApp } from "../src/app.js";
import { localDay, streakDays } from "../src/core/domain.js";
test("concurrent retries award once, validation, CORS, refresh logout and tombstones", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  const app = await createApp({
    db,
    secret: "edge-case-test-secret-at-least-32-characters",
    testing: true,
  });
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "edges@example.com",
      password: "Secure-password-123",
      display_name: "Test",
      timezone: "UTC",
    },
  });
  const { token, refresh_token, user } = reg.json();
  const headers = { authorization: `Bearer ${token}` };
  try {
    const cors = await app.inject({
      method: "OPTIONS",
      url: "/api/users/me/goals",
      headers: {
        origin: "http://localhost:8084",
        "access-control-request-method": "PATCH",
      },
    });
    assert.ok(cors.headers["access-control-allow-methods"]?.includes("PATCH"));
    const id = randomUUID(),
      log_date = localDay("UTC"),
      url = "/api/v2/water/" + id,
      payload = { log_date, amount_ml: 250 };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({ method: "PUT", url, headers, payload }),
      ),
    );
    assert.ok(results.every((r) => r.statusCode === 200));
    assert.equal(
      results.reduce((n, r) => n + r.json().awarded_xp, 0),
      15,
    );
    const mealId = randomUUID();
    const nutrition = { calories: 200, protein_g: 10, carbs_g: 20, fat_g: 5 };
    const entry = {
      id: mealId,
      log_date,
      name: "Rice",
      meal_type: "lunch",
      quantity: 1,
      serving_unit: "serving",
      ...nutrition,
      base_nutrition: nutrition,
    };
    const meals = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({
          method: "PUT",
          url: "/api/v2/entries/" + mealId,
          headers,
          payload: entry,
        }),
      ),
    );
    assert.ok(meals.every((r) => r.statusCode === 200));
    assert.equal(
      meals.reduce((n, r) => n + r.json().awarded_xp, 0),
      35,
    );
    const stale = await Promise.all(
      [1, 2].map((quantity) =>
        app.inject({
          method: "PATCH",
          url: "/api/v2/entries/" + mealId,
          headers,
          payload: { quantity, meal_type: "lunch", version: 1 },
        }),
      ),
    );
    assert.deepEqual(stale.map((r) => r.statusCode).sort(), [200, 409]);
    await app.inject({
      method: "DELETE",
      url: "/api/v2/entries/" + mealId,
      headers,
    });
    const retry = await app.inject({
      method: "PUT",
      url: "/api/v2/entries/" + mealId,
      headers,
      payload: entry,
    });
    assert.ok(retry.json().entry.deleted_at);
    assert.equal(retry.json().awarded_xp, 0);
    const invalid = await app.inject({
      method: "PUT",
      url: "/api/v2/water/" + randomUUID(),
      headers,
      payload: { log_date: "2026-02-30", amount_ml: -1 },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/users/me/settings",
          headers,
          payload: { is_admin: true },
        })
      ).statusCode,
      400,
    );
    await db.query(
      "UPDATE sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1",
      [user.id],
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/users/me", headers }))
        .statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          payload: { refresh_token },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await db.query("SELECT * FROM sessions WHERE user_id=$1", [user.id]))
        .length,
      0,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
test("streak day boundaries preserve yesterday and stop at missing days", () => {
  assert.equal(streakDays(["2026-09-20", "2026-09-19"], "2026-09-21"), 2);
  assert.equal(streakDays(["2026-09-21", "2026-09-19"], "2026-09-21"), 1);
  assert.equal(streakDays(["2026-09-19"], "2026-09-21"), 0);
  assert.equal(
    localDay("Asia/Kolkata", new Date("2026-09-20T20:00:00Z")),
    "2026-09-21",
  );
});
