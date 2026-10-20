// Explicit live smoke check: creates disposable accounts, verifies isolation,
// then deletes its own test accounts through the deployed API. Never uses real diaries.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
if (process.env.FITKIN_LIVE_TEST !== "1")
  throw Error(
    "Set FITKIN_LIVE_TEST=1 to run the disposable-account live checks.",
  );
const endpoint = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL;
if (
  !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(
    endpoint || "",
  )
)
  throw Error("Set EXPO_PUBLIC_APPS_SCRIPT_URL.");
const apiKey =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  "AIzaSyDsMmb8fF3tBvvCJ8Dy_7uGbp-nY8PQ_RY";
const accounts = [],
  checks = [];
async function firebase(action, body) {
  const r = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:" +
      action +
      "?key=" +
      apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    },
  );
  const data = await r.json();
  if (!r.ok)
    throw Error(
      "Firebase " +
        action +
        " returned " +
        r.status +
        " " +
        String(data.error?.message || ""),
    );
  return data;
}
async function request(
  a,
  path,
  method = "GET",
  body = {},
  requestId = randomUUID(),
) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      protocol: 1,
      path,
      method,
      body,
      token: a?.idToken,
      session: a?.session,
      requestId,
    }),
    signal: AbortSignal.timeout(90000),
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw Error("Apps Script returned non-JSON (HTTP " + r.status + ").");
  }
  assert.equal(r.status, 200);
  return result;
}
async function ok(a, path, method = "GET", body = {}, requestId) {
  const r = await request(a, path, method, body, requestId);
  assert.equal(r.status, 200, method + " " + path + ": " + r.data?.error);
  return r.data;
}
async function signIn(a) {
  const auth = await firebase("signInWithPassword", {
    email: a.email,
    password: a.password,
    returnSecureToken: true,
  });
  a.idToken = auth.idToken;
  a.refreshToken = auth.refreshToken;
  const connected = await ok(a, "/api/auth/session", "POST", {
    display_name: "Disposable migration check",
    timezone: "UTC",
  });
  a.session = connected.sheet_session;
  a.user = connected.user;
  return a;
}
async function create() {
  const a = {
    email: "fitkin-migration-" + randomUUID() + "@example.invalid",
    password: randomBytes(24).toString("base64url"),
  };
  const auth = await firebase("signUp", {
    email: a.email,
    password: a.password,
    returnSecureToken: true,
  });
  Object.assign(a, auth);
  accounts.push(a);
  return signIn(a);
}
function pass(name) {
  checks.push(name);
  console.log("PASS " + name);
}
const readiness = await fetch(endpoint, {
  signal: AbortSignal.timeout(30000),
}).then((r) => r.json());
assert.equal(
  readiness.data?.ready,
  true,
  "Activate the final verified import before live checks.",
);
let failure;
try {
  const a = await create(),
    b = await create();
  assert.notEqual(a.user.id, b.user.id);
  pass("registration and sign-in");
  const today = new Date().toISOString().slice(0, 10),
    foodId = randomUUID(),
    meal = {
      id: foodId,
      log_date: today,
      name: "Disposable idli",
      meal_type: "breakfast",
      quantity: 2,
      serving_unit: "piece",
      base_nutrition: { calories: 60, protein_g: 2, carbs_g: 12, fat_g: 1 },
      calories: 120,
      protein_g: 4,
      carbs_g: 24,
      fat_g: 2,
      source: "manual",
    };
  const rid = randomUUID(),
    first = await ok(a, "/api/v2/entries/" + foodId, "PUT", meal, rid),
    retry = await ok(a, "/api/v2/entries/" + foodId, "PUT", meal, rid);
  assert.deepEqual(first, retry);
  let snapshot = await ok(a, "/api/v3/snapshot");
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.progress.xp, 35);
  pass("food sync and retry-safe XP");
  const patch = { version: 1, quantity: 3, meal_type: "lunch" },
    pid = randomUUID();
  await ok(a, "/api/v2/entries/" + foodId, "PATCH", patch, pid);
  const edited = await ok(a, "/api/v2/entries/" + foodId, "PATCH", patch, pid);
  assert.equal(edited.entry.calories, 180);
  assert.equal(
    (await request(a, "/api/v2/entries/" + foodId, "PATCH", patch)).status,
    409,
  );
  pass("edit replay and conflict handling");
  assert.equal(
    (await request(b, "/api/v2/entries/" + foodId, "DELETE")).status,
    409,
  );
  assert.equal((await ok(b, "/api/v3/snapshot")).entries.length, 0);
  pass("account isolation");
  const water = randomUUID(),
    fitness = randomUUID(),
    custom = randomUUID();
  await ok(a, "/api/v2/water/" + water, "PUT", {
    log_date: today,
    amount_ml: 250,
  });
  await ok(a, "/api/v2/fitness/" + fitness, "PUT", {
    kind: "workout",
    log_date: today,
    name: "Disposable walk",
    start: today + "T08:00:00.000Z",
    minutes: 30,
    calories: 100,
    energyPolicy: "auto",
    notes: "",
  });
  await ok(a, "/api/v2/foods/custom/" + custom, "PUT", {
    name: "Disposable food",
    serving_qty: 1,
    serving_unit: "bowl",
    calories: 100,
    protein_g: 5,
    carbs_g: 10,
    fat_g: 5,
  });
  const targets = await ok(a, "/api/users/me/goals", "PATCH", {
    goal_type: "maintain",
    calorie_goal: 2000,
    protein_goal_g: 100,
    carbs_goal_g: 250,
    fat_goal_g: 67,
  });
  assert.equal(targets.user.onboarding_complete, true);
  await ok(a, "/api/users/me/settings", "PATCH", { step_goal: 6000 });
  const exported = await ok(a, "/api/users/me/export");
  assert.equal(exported.entries.length, 1);
  assert.equal(exported.water.length, 1);
  assert.equal(exported.fitness.length, 1);
  assert.equal(exported.foods.length, 1);
  assert.equal(exported.user.settings.step_goal, 6000);
  pass("fitness, water, custom foods, targets and export");
  await ok(a, "/api/v2/entries/" + foodId, "DELETE");
  assert.ok((await ok(a, "/api/v3/snapshot")).entries[0].deleted_at);
  pass("delete tombstones");
  const status = await ok(a, "/api/v2/chat/status");
  if (status.available) {
    const reply = await request(a, "/api/v2/chat", "POST", {
      date: today,
      includeDiary: false,
      messages: [
        {
          role: "user",
          content: "Say hello in one short sentence. Do not make reminders.",
        },
      ],
    });
    if (reply.status === 200) {
      assert.equal(typeof reply.data.reply, "string");
      assert.ok(reply.data.reply.length);
      pass("free-only Kin reply");
    } else if ([429, 503].includes(reply.status)) {
      console.log(
        "LIMITATION Free chat provider unavailable: " + reply.data.error,
      );
      checks.push("chat reports free-provider unavailability");
    } else
      throw Error(
        "Unexpected chat response " + reply.status + ": " + reply.data?.error,
      );
  }
  await ok(a, "/api/auth/logout", "POST");
  assert.equal((await request(a, "/api/users/me")).status, 401);
  await signIn(a);
  assert.equal((await ok(a, "/api/v3/snapshot")).water.length, 1);
  pass("logout revocation and re-login persistence");
  const refreshed = await fetch(
    "https://securetoken.googleapis.com/v1/token?key=" + apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: a.refreshToken,
      }),
      signal: AbortSignal.timeout(25000),
    },
  ).then((r) => r.json());
  assert.ok(refreshed.id_token);
  a.idToken = refreshed.id_token;
  await ok(a, "/api/users/me");
  pass("Firebase token refresh");
} catch (e) {
  failure = e;
  console.error("FAIL " + e.message);
} finally {
  for (const a of accounts) {
    try {
      if (a.session) {
        await signIn(a);
        await ok(a, "/api/users/me", "DELETE");
      } else await firebase("delete", { idToken: a.idToken });
      console.log("Cleaned disposable account.");
    } catch (e) {
      console.error("Cleanup needs retry: " + e.message);
      fs.mkdirSync(".data", { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        ".data/live-smoke-cleanup.json",
        JSON.stringify(accounts),
        { mode: 0o600 },
      );
      failure ||= e;
    }
  }
}
fs.mkdirSync(".data", { recursive: true, mode: 0o700 });
fs.writeFileSync(
  ".data/google-live-checks.json",
  JSON.stringify(
    { at: new Date().toISOString(), passed: !failure, checks },
    null,
    2,
  ),
  { mode: 0o600 },
);
if (failure) process.exitCode = 1;
else console.log("All live core checks passed; disposable accounts removed.");
