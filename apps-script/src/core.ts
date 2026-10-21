import { z } from "zod";
import {
  entrySchema,
  nutrition,
  settingsSchema,
  day,
  localDay,
  streakDays,
  levelForXp,
  safeUser,
} from "../../shared/validation";
import { goalsSchema, calculateGoals } from "../../shared/nutrition";
import { chatInput } from "../../shared/chat";
import { Store, fail } from "./store";
export type Identity = { uid: string; email: string; authTime: number };
export type Request = {
  method: string;
  path: string;
  body?: any;
  session?: string;
  requestId?: string;
};
export type Services = {
  now: () => number;
  uuid: () => string;
  hash: (text: string) => string;
  chatAvailable: boolean;
  chat: (messages: any, context: any) => any;
};
const uuid = z.string().uuid();
const profile = z
  .object({
    display_name: z.string().trim().min(1).max(80).optional(),
    age: z.number().int().min(18).max(120).optional(),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
    height_cm: z.number().min(80).max(250).optional(),
    weight_kg: z.number().min(25).max(400).optional(),
    weight_goal_kg: z.number().min(25).max(400).nullable().optional(),
    activity_level: z
      .enum([
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "extra_active",
      ])
      .optional(),
    timezone: z.string().max(80).optional(),
  })
  .strict();
const fitness = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("workout"),
      log_date: day,
      name: z.string().trim().min(1).max(80),
      start: z.string().datetime(),
      minutes: z.number().positive().max(1440),
      calories: z.number().min(0).max(10000).nullable(),
      energyPolicy: z.enum(["auto", "included", "additional"]),
      notes: z.string().max(500).default(""),
    })
    .strip(),
  z
    .object({
      kind: z.literal("weight"),
      log_date: day,
      weightKg: z.number().min(25).max(400),
    })
    .strip(),
]);
function timezone(value: string) {
  try {
    localDay(value);
  } catch {
    fail(400, "Choose a valid timezone.");
  }
  return value;
}
function publicUser(user: any) {
  const { deleting, ...rest } = safeUser(user);
  return rest;
}
function owned(store: Store, kind: string, id: string, uid: string) {
  const r = store.get(kind, id);
  if (r && r.owner !== uid) fail(409, "Record identifier unavailable.");
  return r?.value;
}
function award(
  store: Store,
  uid: string,
  date: string,
  key: string,
  amount: number,
) {
  const id = [uid, date, key].join("|");
  if (store.get("xp", id)) return 0;
  store.put("xp", id, uid, {
    user_id: uid,
    log_date: date,
    event_key: key,
    amount,
  });
  return amount;
}
export function progress(store: Store, user: any, now: number) {
  const events = store.list("xp", user.id),
    xp = events.reduce((n, e) => n + Number(e.amount), 0),
    dates = [...new Set(events.map((e) => e.log_date as string))]
      .sort()
      .reverse(),
    today = localDay(user.timezone, new Date(now)),
    meals = store.list("entry", user.id).filter((e) => !e.deleted_at).length,
    level = levelForXp(xp);
  return {
    xp,
    ...level,
    dates,
    streak: streakDays(dates, today),
    today_events: {
      date: today,
      keys: events.filter((e) => e.log_date === today).map((e) => e.event_key),
    },
    badges: [
      ["first-spark", "First spark", "Your first little win", xp > 0],
      ["meal-explorer", "Meal explorer", "Remember 10 meals", meals >= 10],
      [
        "seven-days",
        "Seven little days",
        "Earn a little win on 7 days",
        dates.length >= 7,
      ],
      ["momentum", "Momentum", "Reach level 5", level.level >= 5],
      [
        "mindful-month",
        "A mindful month",
        "Earn a little win on 30 days",
        dates.length >= 30,
      ],
      ["good-company", "Good company", "Remember 60 meals", meals >= 60],
    ].map(([id, name, description, unlocked]) => ({
      id,
      name,
      description,
      unlocked,
    })),
  };
}
export function execute(
  store: Store,
  identity: Identity,
  req: Request,
  env: Services,
): any {
  const method = req.method.toUpperCase(),
    path = req.path,
    b = req.body || {},
    now = env.now(),
    stamp = new Date(now).toISOString();
  let account = [...store.rows.values()].find(
    (r) => r.kind === "user" && r.owner === identity.uid,
  );
  if (method === "POST" && path === "/api/auth/session") {
    if (now / 1000 - identity.authTime > 300)
      fail(401, "Please sign in again to start a new session.");
    const input = z
      .object({
        display_name: z.string().trim().min(1).max(80).default("Friend"),
        timezone: z.string().max(80).default("UTC"),
      })
      .strict()
      .parse(b);
    timezone(input.timezone);
    if (account?.value.deleting) return { deleteFirebase: true };
    if (!account) {
      const id = env.uuid();
      store.put("user", id, identity.uid, {
        id,
        firebase_uid: identity.uid,
        email: identity.email,
        display_name: input.display_name,
        timezone: input.timezone,
        age: null,
        gender: null,
        height_cm: null,
        weight_kg: null,
        weight_goal_kg: null,
        activity_level: null,
        goal_type: null,
        calorie_goal: 2000,
        protein_goal_g: 100,
        carbs_goal_g: 250,
        fat_goal_g: 67,
        onboarding_complete: false,
        settings: {
          water_goal_ml: 2000,
          meal_reminders: false,
          water_reminders: false,
          quest_reminders: false,
          haptics: true,
        },
        created_at: stamp,
        updated_at: stamp,
      });
      account = store.get("user", id);
    }
    const sessions = store.list("session", account!.id);
    for (const s of sessions)
      if (s.expires <= now) store.remove("session", s.id);
    if (sessions.filter((s) => s.expires > now).length >= 20)
      fail(429, "Too many active sign-ins. Sign out of another device first.");
    const secret = env.uuid() + env.uuid(),
      id = env.hash(secret);
    store.put("session", id, account!.id, {
      id,
      authTime: identity.authTime,
      expires: now + 30 * 86400000,
    });
    return { user: publicUser(account!.value), sheet_session: secret };
  }
  if (!account) fail(401, "Sign in to finish connecting your account.");
  const user = account.value,
    uid = user.id;
  const session = req.session && store.get("session", env.hash(req.session));
  if (
    !session ||
    session.owner !== uid ||
    session.value.expires <= now ||
    identity.authTime < session.value.authTime
  )
    fail(401, "Your session has ended. Please sign in again.");
  if (path === "/api/auth/logout" && method === "POST") {
    store.remove("session", session.id);
    return { ok: true };
  }
  if (user.deleting && !(path === "/api/users/me" && method === "DELETE"))
    fail(403, "Account deletion is pending.");
  if (method === "DELETE" && path === "/api/users/me") {
    if (now / 1000 - identity.authTime > 300)
      fail(401, "Sign in again before deleting your account.");
    // Minimal tombstone blocks recreation while Firebase deletion is retried. No diary/profile remains.
    store.removeOwner(uid);
    store.put("session", session.id, uid, session.value);
    store.put("user", uid, identity.uid, {
      id: uid,
      firebase_uid: identity.uid,
      deleting: true,
    });
    return { ok: true, deleteFirebase: true };
  }
  if (path === "/api/v3/batch" && method === "POST") {
    const input = z
      .object({
        operations: z
          .array(
            z
              .object({
                method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
                path: z
                  .string()
                  .regex(
                    /^\/api\/v2\/(?:check-in|(?:entries|water|fitness|foods\/custom)\/[0-9a-f-]{36})$/i,
                  ),
                body: z.any().optional(),
                requestId: uuid,
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict()
      .parse(b);
    const results = input.operations.map((op) => {
      // Isolate validation failures so a partially changed record is never
      // committed; accepted operations share one atomic storage write.
      const candidate = new Store([...store.rows.values()]);
      try {
        const data = execute(
          candidate,
          identity,
          { ...op, session: req.session },
          env,
        );
        for (const [key, row] of candidate.dirty) {
          if (row) store.put(row.kind, row.id, row.owner, row.value);
          else {
            store.rows.delete(key);
            store.dirty.set(key, null);
          }
        }
        return { requestId: op.requestId, status: 200, data };
      } catch (error: any) {
        const status = error.name === "ZodError" ? 400 : error.status;
        if (![400, 404, 409].includes(status)) throw error;
        return {
          requestId: op.requestId,
          status,
          data: {
            error:
              error.name === "ZodError"
                ? "Please check this record’s details."
                : error.message,
          },
        };
      }
    });
    return {
      results,
      snapshot: execute(
        store,
        identity,
        { method: "GET", path: "/api/v3/snapshot", session: req.session },
        env,
      ),
    };
  }
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  let receiptId = "",
    fingerprint = "";
  if (write) {
    uuid.parse(req.requestId);
    receiptId = uid + "|" + req.requestId;
    fingerprint = env.hash(JSON.stringify([method, path, b]));
    const receipt = store.get("receipt", receiptId);
    if (receipt) {
      if (receipt.value.fingerprint !== fingerprint)
        fail(409, "Request identifier was already used.");
      if (receipt.value.pending) {
        if (receipt.value.pendingUntil > now)
          fail(425, "Your message is still being prepared. Please wait.");
        store.remove("receipt", receiptId);
      } else return receipt.value.response;
    }
  }
  const result = route();
  if (write) {
    store.put("receipt", receiptId, uid, {
      fingerprint,
      ...(result.pendingChat
        ? { pending: true, pendingUntil: now + 6 * 60000 }
        : { response: result }),
      expires: now + 30 * 86400000,
    });
    for (const r of [...store.rows.values()])
      if (r.kind === "receipt" && r.owner === uid && r.value.expires < now)
        store.remove(r.kind, r.id);
  }
  return result;
  function route(): any {
    if (path === "/api/users/me" && method === "GET")
      return { user: publicUser(user) };
    if (path === "/api/users/me" && method === "PATCH") {
      const changes = profile.parse(b);
      if (changes.timezone) timezone(changes.timezone);
      const next = { ...user, ...changes, updated_at: stamp };
      store.put("user", uid, identity.uid, next);
      return { user: publicUser(next) };
    }
    if (path === "/api/users/me/goals" && method === "PATCH") {
      const input = goalsSchema.parse(b),
        targets = calculateGoals(input);
      const next = {
        ...user,
        ...input,
        ...targets,
        onboarding_complete: true,
        updated_at: stamp,
      };
      delete next.maintenance_calories;
      store.put("user", uid, identity.uid, next);
      return {
        user: publicUser(next),
        maintenance_calories: targets.maintenance_calories,
      };
    }
    if (path === "/api/users/me/settings" && method === "PATCH") {
      const changes = settingsSchema.parse(b),
        next = {
          ...user,
          settings: { ...user.settings, ...changes },
          updated_at: stamp,
        };
      store.put("user", uid, identity.uid, next);
      return { user: publicUser(next) };
    }
    if (path === "/api/v2/progress" && method === "GET")
      return progress(store, user, now);
    if (path === "/api/v3/snapshot" && method === "GET")
      return {
        entries: store.list("entry", uid),
        water: store.list("water", uid),
        fitness: store.list("fitness", uid),
        foods: store.list("food", uid),
        progress: progress(store, user, now),
      };
    if (path === "/api/v2/changes" && method === "GET")
      return {
        cursor: stamp,
        entries: store.list("entry", uid),
        water: store.list("water", uid),
      };
    if (path === "/api/v2/fitness" && method === "GET")
      return { records: store.list("fitness", uid) };
    if (path === "/api/v2/foods/custom" && method === "GET")
      return { foods: store.list("food", uid) };
    if (path === "/api/users/me/export" && method === "GET")
      return {
        user: publicUser(user),
        entries: store.list("entry", uid),
        water: store.list("water", uid),
        fitness: store.list("fitness", uid),
        foods: store.list("food", uid),
        xp_events: store.list("xp", uid),
        progress: progress(store, user, now),
      };
    if (path === "/api/v2/check-in" && method === "POST")
      return {
        awarded_xp: award(
          store,
          uid,
          localDay(user.timezone, new Date(now)),
          "check-in",
          10,
        ),
      };
    const match = path.match(
      /^\/api\/v2\/(entries|water|fitness|foods\/custom)\/([^/]+)$/,
    );
    if (match) {
      const id = uuid.parse(match[2]),
        kind = (
          {
            entries: "entry",
            water: "water",
            fitness: "fitness",
            "foods/custom": "food",
          } as Record<string, string>
        )[match[1]],
        existing = owned(store, kind, id, uid);
      if (method === "DELETE" && kind !== "food") {
        if (existing && !existing.deleted_at)
          store.put(kind, id, uid, {
            ...existing,
            deleted_at: stamp,
            updated_at: stamp,
            version: (existing.version || 1) + 1,
          });
        return { ok: true };
      }
      if (method === "PUT") {
        let value: any;
        if (kind === "entry") {
          const v = entrySchema.parse(b);
          if (v.id !== id) fail(400, "Entry IDs must match.");
          value = { ...v, ...portion(v.base_nutrition, v.quantity) };
        }
        if (kind === "water")
          value = z
            .object({
              log_date: day,
              amount_ml: z.number().int().min(1).max(5000),
            })
            .strict()
            .parse(b);
        if (kind === "fitness") value = fitness.parse(b);
        if (kind === "food")
          value = nutrition
            .extend({
              name: z.string().trim().min(1).max(200),
              serving_qty: z.number().positive().max(10000),
              serving_unit: z.string().trim().min(1).max(50),
            })
            .parse(b);
        if (existing)
          return kind === "entry"
            ? { entry: existing, awarded_xp: 0 }
            : kind === "fitness"
              ? { record: existing }
              : { ok: true, awarded_xp: 0 };
        value = {
          ...value,
          id,
          user_id: uid,
          version: 1,
          created_at: stamp,
          updated_at: stamp,
          deleted_at: null,
        };
        store.put(kind, id, uid, value);
        let awarded = 0;
        const today = localDay(user.timezone, new Date(now));
        if (value.log_date === today && kind === "entry") {
          awarded += award(store, uid, today, "meal:" + value.meal_type, 25);
          const count = store
            .list("xp", uid)
            .filter(
              (e) => e.log_date === today && e.event_key.startsWith("food:"),
            ).length;
          if (count < 20) awarded += award(store, uid, today, "food:" + id, 10);
        }
        if (value.log_date === today && kind === "water")
          awarded = award(store, uid, today, "hydration", 15);
        return kind === "entry"
          ? { entry: value, awarded_xp: awarded }
          : kind === "fitness"
            ? { record: value }
            : { ok: true, awarded_xp: awarded };
      }
      if (method === "PATCH" && (kind === "entry" || kind === "fitness")) {
        const { version, ...input } = z
          .object({ version: z.number().int().positive() })
          .passthrough()
          .parse(b);
        if (!existing || existing.deleted_at || existing.version !== version)
          fail(
            409,
            "This record changed on another device. Sync and try again.",
          );
        let next: any;
        if (kind === "entry") {
          const v = z
            .object({
              quantity: z.number().positive().max(10000),
              meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
            })
            .strict()
            .parse(input);
          next = {
            ...existing,
            ...v,
            ...portion(existing.base_nutrition, v.quantity),
          };
        } else {
          const v = fitness.parse(input);
          if (v.kind !== existing.kind) fail(400, "Record type cannot change.");
          next = { ...existing, ...v };
        }
        next = { ...next, version: version + 1, updated_at: stamp };
        store.put(kind, id, uid, next);
        return kind === "entry" ? { entry: next } : { record: next };
      }
    }
    if (path === "/api/v2/chat/status" && method === "GET")
      return { available: env.chatAvailable, freeOnly: true };
    if (path === "/api/v2/chat" && method === "POST") {
      const input = chatInput.parse(b);
      const counter = store.get("quota", "chat|" + uid)?.value || {
        window: now,
        count: 0,
      };
      if (now - counter.window >= 60000) {
        counter.window = now;
        counter.count = 0;
      }
      if (counter.count >= 5)
        fail(429, "Give Kin a moment before your next message.");
      store.put("quota", "chat|" + uid, uid, {
        ...counter,
        count: counter.count + 1,
      });
      return env.chat(input.messages, chatContext(store, user, input));
    }
    fail(404, "This action is not supported. Update Fitkin and try again.");
  }
}
function portion(base: any, quantity: number) {
  return Object.fromEntries(
    ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"].map((k) => [
      k,
      base[k] == null ? null : Math.round(base[k] * quantity * 100) / 100,
    ]),
  );
}
export function chatContext(
  store: Store,
  user: any,
  b: z.infer<typeof chatInput>,
) {
  if (!b.includeDiary) return { date: b.date, diaryShared: false };
  const uid = user.id,
    foods = store
      .list("entry", uid)
      .filter((e) => !e.deleted_at && e.log_date === b.date)
      .slice(0, 60)
      .map(
        ({
          name,
          meal_type,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          quantity,
          serving_unit,
        }) => ({
          name,
          meal_type,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          quantity,
          serving_unit,
        }),
      );
  const start = new Date(b.date + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 29);
  const from = start.toISOString().slice(0, 10),
    days = new Map<string, any>();
  for (const e of store.list("entry", uid))
    if (!e.deleted_at && e.log_date >= from && e.log_date <= b.date) {
      const d = days.get(e.log_date) || {
        log_date: e.log_date,
        calories: 0,
        entries: 0,
      };
      d.calories += e.calories;
      d.entries++;
      days.set(e.log_date, d);
    }
  const history = store
      .list("fitness", uid)
      .filter((e) => !e.deleted_at && e.log_date <= b.date)
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .slice(0, 90),
    weights = history
      .filter((e) => e.kind === "weight")
      .sort((a, b) => a.log_date.localeCompare(b.log_date)),
    first = weights[0],
    last = weights[weights.length - 1],
    span =
      first && last
        ? (Date.parse(last.log_date) - Date.parse(first.log_date)) / 86400000
        : 0;
  return {
    date: b.date,
    diaryShared: true,
    name: user.display_name,
    currentWeightKg: user.weight_kg,
    targetWeightKg: user.weight_goal_kg,
    timezone: user.timezone,
    goals: {
      calories: user.calorie_goal,
      protein: user.protein_goal_g,
      carbs: user.carbs_goal_g,
      fat: user.fat_goal_g,
      water: user.settings.water_goal_ml,
      steps: user.settings.step_goal ?? null,
      activeCalories: user.settings.move_goal_kcal ?? null,
    },
    foods,
    waterMl: store
      .list("water", uid)
      .filter((e) => !e.deleted_at && e.log_date === b.date)
      .reduce((n, e) => n + e.amount_ml, 0),
    activity: b.activity
      ? {
          ...b.activity,
          provenance: "User-shared device estimate; may be incomplete",
        }
      : "Not available to this chat",
    fitnessHistory: history,
    observedWeightTrend:
      span >= 14 && weights.length >= 3
        ? {
            days: span,
            readings: weights.length,
            changeKg: Math.round((last.weightKg - first.weightKg) * 100) / 100,
            notAPrediction: true,
          }
        : "Need at least three dated weigh-ins spanning two weeks to discuss a trend",
    recentFoodSummary: {
      from,
      to: b.date,
      loggedDays: days.size,
      caloriesLogged: [...days.values()].reduce((n, e) => n + e.calories, 0),
      days: [...days.values()],
      completeness: "Unknown; do not treat unlogged days as zero intake",
    },
    logsMayBeIncomplete: true,
  };
}
