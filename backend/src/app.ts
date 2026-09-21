import { createChatService, chatInput, type ChatService } from "./core/chat.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import type { FirebaseAccounts, FirebaseIdentity } from "./core/firebase.js";
import type { DB } from "./core/database.js";
import {
  day,
  email,
  password,
  entrySchema,
  nutrition,
  settingsSchema,
  hashToken,
  opaqueToken,
  safeUser,
  normalizeEntry,
  localDay,
  streakDays,
  levelForXp,
} from "./core/domain.js";

export interface AppOptions {
  chat?: ChatService;
  db: DB;
  secret: string;
  testing?: boolean;
  firebase?: FirebaseAccounts;
  sendRecovery?: (email: string, token: string) => Promise<void>;
}
export async function createApp({
  db,
  secret,
  testing = false,
  sendRecovery,
  firebase,
  chat = createChatService(process.env.OPENROUTER_API_KEY),
}: AppOptions) {
  if (secret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  const app = Fastify({ logger: !testing, bodyLimit: 1024 * 256 });
  await app.register(cors, {
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin:
      process.env.CORS_ORIGIN?.split(",") ??
      (process.env.NODE_ENV === "production" ? false : true),
  });
  await app.register(jwt, { secret });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    allowList: testing ? () => true : undefined,
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        error: error.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join("; "),
      });
    if ((error as any).code === "23505")
      return reply.code(409).send({ error: "This record already exists." });
    if ((error as any).statusCode && (error as any).statusCode < 500)
      return reply
        .code((error as any).statusCode)
        .send({ error: (error as any).message });
    app.log.error(error);
    return reply
      .code(500)
      .send({ error: "Something went wrong. Please try again." });
  });
  const fail = (code: number, message: string) =>
    Object.assign(new Error(message), { statusCode: code });
  const userId = (req: any) => req.user.sub as string;
  const authenticate = async (req: any) => {
    await req.jwtVerify();
    if (req.user.type !== "access" || !req.user.sid)
      throw fail(401, "Please sign in again.");
    const [session] = await db.query(
      "SELECT s.id,s.firebase_auth_time,u.firebase_uid FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>NOW()",
      [req.user.sid, req.user.sub],
    );
    if (session?.firebase_uid) {
      if (!firebase) throw fail(503, "Account service is not configured.");
      await firebase.assertSession(
        session.firebase_uid,
        Number(session.firebase_auth_time),
      );
    }
    if (!session)
      throw fail(401, "Your session has ended. Please sign in again.");
  };
  const auth = { onRequest: authenticate };
  const limited = {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  };
  async function issue(user: Record<string, any>, firebaseAuthTime?: number) {
    const id = randomUUID(),
      refresh = opaqueToken();
    await db.query(
      "INSERT INTO sessions(id,user_id,refresh_hash,expires_at,firebase_auth_time) VALUES($1,$2,$3,NOW()+INTERVAL '30 days',$4)",
      [id, user.id, hashToken(refresh), firebaseAuthTime ?? null],
    );
    return {
      user: safeUser(user),
      token: app.jwt.sign(
        { sub: user.id, sid: id, type: "access" },
        { expiresIn: "15m" },
      ),
      refresh_token: refresh,
    };
  }
  async function firebaseUser(
    identity: FirebaseIdentity,
    name = "Friend",
    timezone = "UTC",
  ) {
    const [existing] = await db.query(
      "SELECT * FROM users WHERE firebase_uid=$1",
      [identity.uid],
    );
    if (existing) return existing;
    const [collision] = await db.query(
      "SELECT id FROM users WHERE LOWER(email)=$1",
      [identity.email],
    );
    if (collision)
      throw fail(
        409,
        "This email belongs to an existing account. Contact support to link it.",
      );
    const [user] = await db.query(
      "INSERT INTO users(id,email,firebase_uid,display_name,timezone) VALUES($1,$2,$3,$4,$5) ON CONFLICT(firebase_uid) DO UPDATE SET updated_at=NOW() RETURNING *",
      [randomUUID(), identity.email, identity.uid, name, timezone],
    );
    return user;
  }
  async function xp(
    tx: DB,
    uid: string,
    date: string,
    key: string,
    amount: number,
  ) {
    const rows = await tx.query(
      "INSERT INTO xp_events(user_id,log_date,event_key,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING amount",
      [uid, date, key, amount],
    );
    return rows.length ? amount : 0;
  }
  async function getUser(uid: string, conn: DB = db) {
    const [user] = await conn.query("SELECT * FROM users WHERE id=$1", [uid]);
    if (!user) throw fail(404, "Account not found.");
    return user;
  }
  async function progress(uid: string) {
    const [total] = await db.query(
      "SELECT COALESCE(SUM(amount),0)::int AS xp FROM xp_events WHERE user_id=$1",
      [uid],
    );
    const days = await db.query(
      "SELECT DISTINCT log_date FROM xp_events WHERE user_id=$1 ORDER BY log_date DESC",
      [uid],
    );
    const [meals] = await db.query(
      "SELECT COUNT(*)::int AS count FROM entries_v2 WHERE user_id=$1 AND deleted_at IS NULL",
      [uid],
    );
    const user = await getUser(uid);
    const today = localDay(user.timezone);
    const dates = days.map((d) => d.log_date);
    const count = Number(total.xp);
    const level = levelForXp(count);
    const badges = [
      {
        id: "first-spark",
        name: "First spark",
        description: "Your first little win",
        unlocked: count > 0,
      },
      {
        id: "meal-explorer",
        name: "Meal explorer",
        description: "Remember 10 meals",
        unlocked: meals.count >= 10,
      },
      {
        id: "seven-days",
        name: "Seven little days",
        description: "Earn a little win on 7 days",
        unlocked: dates.length >= 7,
      },
      {
        id: "momentum",
        name: "Momentum",
        description: "Reach level 5",
        unlocked: level.level >= 5,
      },
      {
        id: "mindful-month",
        name: "A mindful month",
        description: "Earn a little win on 30 days",
        unlocked: dates.length >= 30,
      },
      {
        id: "good-company",
        name: "Good company",
        description: "Remember 60 meals",
        unlocked: meals.count >= 60,
      },
    ];
    return {
      today_events: {
        date: today,
        keys: (
          await db.query(
            "SELECT event_key FROM xp_events WHERE user_id=$1 AND log_date=$2",
            [uid, today],
          )
        ).map((e) => e.event_key),
      },
      xp: count,
      ...level,
      streak: streakDays(dates, today),
      dates,
      badges,
    };
  }
  // Liveness never queries Neon: scheduled probes must not keep its compute awake.
  const liveness = async () => ({
    status: "ok",
    ai: "optional-online-chat",
    version: 2,
  });
  app.get("/health", liveness);
  app.get("/ping", { logLevel: "silent" }, liveness);
  app.get("/ready", async () => {
    await db.query("SELECT 1");
    return { status: "ok", database: "connected" };
  });
  app.get("/api/config", async () => ({
    google_sign_in: !!process.env.GOOGLE_CLIENT_IDS,
    recovery: !!firebase || !!sendRecovery || testing,
    recovery_mode: firebase ? "email_link" : "code",
    ai: "on-device",
  }));
  app.post("/api/auth/register", limited, async (req, reply) => {
    const body = z
      .object({
        email,
        password,
        display_name: z.string().trim().min(1).max(80),
        timezone: z.string().max(80).default("UTC"),
      })
      .parse(req.body);
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
    } catch {
      throw fail(400, "Choose a valid timezone.");
    }
    if (firebase) {
      const identity = await firebase.register(body.email, body.password);
      const user = await firebaseUser(
        identity,
        body.display_name,
        body.timezone,
      );
      return reply.code(201).send(await issue(user, identity.authTime));
    }
    const [user] = await db.query(
      "INSERT INTO users(id,email,password_hash,display_name,timezone) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        randomUUID(),
        body.email,
        await bcrypt.hash(body.password, testing ? 4 : 12),
        body.display_name,
        body.timezone,
      ],
    );
    return reply.code(201).send(await issue(user));
  });
  app.post("/api/auth/login", limited, async (req) => {
    const body = z
      .object({ email, password: z.string().min(1).max(128) })
      .parse(req.body);
    if (firebase) {
      const identity = await firebase.login(body.email, body.password);
      return issue(await firebaseUser(identity), identity.authTime);
    }
    const [user] = await db.query("SELECT * FROM users WHERE LOWER(email)=$1", [
      body.email,
    ]);
    if (
      !user?.password_hash ||
      !(await bcrypt.compare(body.password, user.password_hash))
    )
      throw fail(401, "Email or password is incorrect.");
    return issue(user);
  });
  app.post("/api/auth/google", limited, async (req) => {
    if (firebase) throw fail(503, "Use email and password to sign in.");
    const audiences = process.env.GOOGLE_CLIENT_IDS?.split(",").filter(Boolean);
    if (!audiences?.length)
      throw fail(
        503,
        "Google sign-in is not configured. Use email to sign in.",
      );
    const { id_token } = z
      .object({ id_token: z.string().min(1) })
      .parse(req.body);
    const ticket = await new OAuth2Client()
      .verifyIdToken({ idToken: id_token, audience: audiences })
      .catch(() => {
        throw fail(401, "Google sign-in could not be verified.");
      });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || !payload.email)
      throw fail(401, "A verified Google email is required.");
    let [user] = await db.query("SELECT * FROM users WHERE LOWER(email)=$1", [
      payload.email.toLowerCase(),
    ]);
    if (user && user.google_id !== payload.sub)
      throw fail(
        409,
        "Sign in with your password. This account is not linked to Google.",
      );
    if (!user)
      [user] = await db.query(
        "INSERT INTO users(id,email,google_id,display_name,avatar_url) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          randomUUID(),
          payload.email.toLowerCase(),
          payload.sub,
          payload.name ?? "Friend",
          payload.picture ?? null,
        ],
      );
    return issue(user);
  });
  app.post("/api/auth/refresh", limited, async (req) => {
    const body = z
      .object({ refresh_token: z.string().min(20).max(256) })
      .parse(req.body);
    if (firebase) {
      const [session] = await db.query(
        "SELECT s.firebase_auth_time,u.firebase_uid FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.refresh_hash=$1 AND s.expires_at>NOW()",
        [hashToken(body.refresh_token)],
      );
      if (!session?.firebase_uid)
        throw fail(401, "Session expired. Please sign in again.");
      await firebase.assertSession(
        session.firebase_uid,
        Number(session.firebase_auth_time),
      );
    }
    const replacement = opaqueToken();
    const [s] = await db.query(
      "UPDATE sessions SET refresh_hash=$1,expires_at=NOW()+INTERVAL '30 days' WHERE refresh_hash=$2 AND expires_at>NOW() RETURNING id,user_id",
      [hashToken(replacement), hashToken(body.refresh_token)],
    );
    if (!s) throw fail(401, "Session expired. Please sign in again.");
    return {
      token: app.jwt.sign(
        { sub: s.user_id, sid: s.id, type: "access" },
        { expiresIn: "15m" },
      ),
      refresh_token: replacement,
    };
  });
  app.delete("/api/auth/logout", auth, async (req) => {
    await db.query("DELETE FROM sessions WHERE id=$1 AND user_id=$2", [
      (req.user as any).sid,
      userId(req),
    ]);
    return { ok: true };
  });
  app.post("/api/auth/logout", limited, async (req) => {
    const { refresh_token } = z
      .object({ refresh_token: z.string().min(20).max(256) })
      .parse(req.body);
    await db.query("DELETE FROM sessions WHERE refresh_hash=$1", [
      hashToken(refresh_token),
    ]);
    return { ok: true };
  });
  app.post("/api/auth/forgot-password", limited, async (req) => {
    if (firebase) {
      const body = z.object({ email }).parse(req.body);
      await firebase.recover(body.email);
      return {
        mode: "email_link",
        message:
          "If an account exists, a password-reset link has been sent. Open the email to choose a new password, then return here to log in.",
      };
    }
    if (!sendRecovery && !testing)
      throw fail(
        503,
        "Email recovery is not configured yet. Please contact support.",
      );
    const body = z.object({ email }).parse(req.body);
    const [user] = await db.query(
      "SELECT id FROM users WHERE LOWER(email)=$1",
      [body.email],
    );
    let token: string | undefined;
    if (user) {
      token = opaqueToken();
      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM password_resets WHERE user_id=$1", [
          user.id,
        ]);
        await tx.query(
          "INSERT INTO password_resets(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')",
          [randomUUID(), user.id, hashToken(token!)],
        );
      });
      if (sendRecovery) await sendRecovery(body.email, token);
    }
    return {
      message: "If an account exists, a recovery code has been sent.",
      ...(testing && token ? { development_token: token } : {}),
    };
  });
  app.post("/api/auth/reset-password", limited, async (req) => {
    if (firebase)
      throw fail(400, "Use the secure password-reset link in your email.");
    const body = z
      .object({ token: z.string().min(20).max(256), password })
      .parse(req.body);
    const hashed = await bcrypt.hash(body.password, testing ? 4 : 12);
    await db.transaction(async (tx) => {
      const [reset] = await tx.query(
        "DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id",
        [hashToken(body.token)],
      );
      if (!reset)
        throw fail(
          400,
          "This recovery code has expired or has already been used.",
        );
      await tx.query(
        "UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2",
        [hashed, reset.user_id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [reset.user_id]);
    });
    return { ok: true };
  });
  app.get("/api/v2/chat/status", auth, async () => ({
    available: chat.available,
    freeOnly: true,
  }));
  app.post(
    "/api/v2/chat",
    {
      ...auth,
      bodyLimit: 30000,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          keyGenerator: (req: any) => req.user.sub,
        },
      },
    },
    async (req, reply) => {
      const b = chatInput.parse(req.body),
        uid = userId(req);
      let context: unknown = { date: b.date, diaryShared: false };
      if (b.includeDiary) {
        const user = await getUser(uid);
        const foods = await db.query(
          "SELECT name,meal_type,calories,protein_g,carbs_g,fat_g,quantity,serving_unit FROM entries_v2 WHERE user_id=$1 AND log_date=$2 AND deleted_at IS NULL ORDER BY created_at LIMIT 60",
          [uid, b.date],
        );
        const [water] = await db.query(
          "SELECT COALESCE(SUM(amount_ml),0)::int AS ml FROM water_entries WHERE user_id=$1 AND log_date=$2 AND deleted_at IS NULL",
          [uid, b.date],
        );
        context = {
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
          },
          foods,
          waterMl: water.ml,
          activity: "Not available to this chat",
          logsMayBeIncomplete: true,
        };
      }
      try {
        return await chat.answer(b.messages, context);
      } catch (e: any) {
        return reply
          .code(e.statusCode === 429 ? 429 : 503)
          .send({ error: e.message });
      }
    },
  );
  app.get("/api/users/me", auth, async (req) => ({
    user: safeUser(await getUser(userId(req))),
  }));
  app.patch("/api/users/me", auth, async (req) => {
    const body = z
      .object({
        display_name: z.string().trim().min(1).max(80).optional(),
        age: z.number().int().min(18).max(120).optional(),
        gender: z
          .enum(["male", "female", "other", "prefer_not_to_say"])
          .optional(),
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
      .strict()
      .parse(req.body);
    if (body.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: body.timezone });
      } catch {
        throw fail(400, "Invalid timezone.");
      }
    }
    const entries = Object.entries(body);
    if (entries.length)
      await db.query(
        `UPDATE users SET ${entries.map(([k], i) => `${k}=$${i + 1}`).join(",")},updated_at=NOW() WHERE id=$${entries.length + 1}`,
        [...entries.map(([, v]) => v), userId(req)],
      );
    return { user: safeUser(await getUser(userId(req))) };
  });
  app.patch("/api/users/me/goals", auth, async (req) => {
    const b = z
      .object({
        goal_type: z.enum(["maintain", "gain_muscle", "lose_weight"]),
        calorie_goal: z.number().int().min(1200).max(6000),
        protein_goal_g: z.number().int().min(0).max(500),
        carbs_goal_g: z.number().int().min(0).max(1000),
        fat_goal_g: z.number().int().min(0).max(500),
      })
      .parse(req.body);
    await db.query(
      "UPDATE users SET goal_type=$1,calorie_goal=$2,protein_goal_g=$3,carbs_goal_g=$4,fat_goal_g=$5,onboarding_complete=TRUE,updated_at=NOW() WHERE id=$6",
      [
        b.goal_type,
        b.calorie_goal,
        b.protein_goal_g,
        b.carbs_goal_g,
        b.fat_goal_g,
        userId(req),
      ],
    );
    return { user: safeUser(await getUser(userId(req))) };
  });
  app.patch("/api/users/me/settings", auth, async (req) => {
    const b = settingsSchema.parse(req.body);
    await db.query(
      "UPDATE users SET settings=settings || $1::jsonb,updated_at=NOW() WHERE id=$2",
      [JSON.stringify(b), userId(req)],
    );
    return { user: safeUser(await getUser(userId(req))) };
  });
  app.delete("/api/users/me", auth, async (req) => {
    const { password: confirmation } = z
      .object({ password: z.string().min(1) })
      .parse(req.body);
    const user = await getUser(userId(req));
    if (user.firebase_uid) {
      if (!firebase) throw fail(503, "Account service is not configured.");
      const identity = await firebase.login(user.email, confirmation);
      if (identity.uid !== user.firebase_uid)
        throw fail(401, "Confirm your password to delete your account.");
      await firebase.remove(user.firebase_uid);
    } else if (
      !user.password_hash ||
      !(await bcrypt.compare(confirmation, user.password_hash))
    )
      throw fail(401, "Confirm your password to delete your account.");
    await db.query("DELETE FROM users WHERE id=$1", [user.id]);
    return { ok: true };
  });
  app.get("/api/users/me/export", auth, async (req) => {
    const uid = userId(req);
    return {
      user: safeUser(await getUser(uid)),
      entries: await db.query("SELECT * FROM entries_v2 WHERE user_id=$1", [
        uid,
      ]),
      water: await db.query("SELECT * FROM water_entries WHERE user_id=$1", [
        uid,
      ]),
      progress: await progress(uid),
    };
  });
  app.put("/api/v2/entries/:id", auth, async (req, reply) => {
    const b = entrySchema.parse(req.body);
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    if (id !== b.id) throw fail(400, "Entry IDs must match.");
    // Nutrition is derived from the reviewed base portion, not trusted duplicated totals.
    const base = b.base_nutrition;
    const totals = ["calories", "protein_g", "carbs_g", "fat_g"].map(
      (k) => Math.round((base as any)[k] * b.quantity * 100) / 100,
    );
    const uid = userId(req);
    let awarded = 0;
    const entry = await db.transaction(async (tx) => {
      const [existing] = await tx.query(
        "SELECT * FROM entries_v2 WHERE id=$1",
        [id],
      );
      if (existing) {
        if (existing.user_id !== uid)
          throw fail(409, "Entry identifier unavailable.");
        return existing;
      }
      let [row] = await tx.query(
        "INSERT INTO entries_v2(id,user_id,log_date,name,food_id,meal_type,quantity,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,base_nutrition,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO NOTHING RETURNING *",
        [
          id,
          uid,
          b.log_date,
          b.name,
          b.food_id ?? null,
          b.meal_type,
          b.quantity,
          b.serving_unit,
          ...totals,
          base.fiber_g == null ? null : base.fiber_g * b.quantity,
          JSON.stringify(base),
          b.source,
        ],
      );
      if (!row) {
        [row] = await tx.query(
          "SELECT * FROM entries_v2 WHERE id=$1 AND user_id=$2",
          [id, uid],
        );
        if (!row) throw fail(409, "Entry identifier unavailable.");
        return row;
      }
      const user = await getUser(uid, tx);
      if (b.log_date === localDay(user.timezone)) {
        // Serialize daily food awards across devices; an entry retry never reaches this branch.
        await tx.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [
          uid,
        ]);
        awarded = await xp(tx, uid, b.log_date, "meal:" + b.meal_type, 25);
        const [earned] = await tx.query(
          "SELECT COUNT(*)::int AS count FROM xp_events WHERE user_id=$1 AND log_date=$2 AND event_key LIKE 'food:%'",
          [uid, b.log_date],
        );
        if (earned.count < 20)
          awarded += await xp(tx, uid, b.log_date, "food:" + id, 10);
      }
      return row;
    });
    return reply
      .code(200)
      .send({ entry: normalizeEntry(entry), awarded_xp: awarded });
  });
  app.patch("/api/v2/entries/:id", auth, async (req) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const b = z
      .object({
        version: z.number().int().positive(),
        quantity: z.number().positive().max(10000),
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      })
      .parse(req.body);
    const [entry] = await db.query(
      "UPDATE entries_v2 SET quantity=$1,meal_type=$2,calories=(base_nutrition->>'calories')::numeric*$1,protein_g=(base_nutrition->>'protein_g')::numeric*$1,carbs_g=(base_nutrition->>'carbs_g')::numeric*$1,fat_g=(base_nutrition->>'fat_g')::numeric*$1,fiber_g=(base_nutrition->>'fiber_g')::numeric*$1,version=version+1,updated_at=NOW() WHERE id=$3 AND user_id=$4 AND version=$5 AND deleted_at IS NULL RETURNING *",
      [b.quantity, b.meal_type, id, userId(req), b.version],
    );
    if (!entry)
      throw fail(
        409,
        "This entry changed on another device. Refresh and try again.",
      );
    return { entry: normalizeEntry(entry) };
  });
  app.delete("/api/v2/entries/:id", auth, async (req) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    await db.query(
      "UPDATE entries_v2 SET deleted_at=NOW(),updated_at=NOW(),version=version+1 WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [id, userId(req)],
    );
    return { ok: true };
  });
  app.put("/api/v2/water/:id", auth, async (req) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const b = z
      .object({ log_date: day, amount_ml: z.number().int().min(1).max(5000) })
      .parse(req.body);
    const uid = userId(req);
    let awarded = 0;
    await db.transaction(async (tx) => {
      const [existing] = await tx.query(
        "SELECT user_id FROM water_entries WHERE id=$1",
        [id],
      );
      if (existing) {
        if (existing.user_id !== uid)
          throw fail(409, "Entry identifier unavailable.");
        return;
      }
      const inserted = await tx.query(
        "INSERT INTO water_entries(id,user_id,log_date,amount_ml) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING user_id",
        [id, uid, b.log_date, b.amount_ml],
      );
      if (!inserted.length) {
        const [owned] = await tx.query(
          "SELECT user_id FROM water_entries WHERE id=$1 AND user_id=$2",
          [id, uid],
        );
        if (!owned) throw fail(409, "Entry identifier unavailable.");
        return;
      }
      const user = await getUser(uid, tx);
      if (b.log_date === localDay(user.timezone))
        awarded = await xp(tx, uid, b.log_date, "hydration", 15);
    });
    return { ok: true, awarded_xp: awarded };
  });
  app.delete("/api/v2/water/:id", auth, async (req) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    await db.query(
      "UPDATE water_entries SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [id, userId(req)],
    );
    return { ok: true };
  });
  app.get("/api/v2/day", auth, async (req) => {
    const date = day.parse(
      (req.query as any).date ??
        localDay((await getUser(userId(req))).timezone),
    );
    const uid = userId(req);
    const entries = (
      await db.query(
        "SELECT * FROM entries_v2 WHERE user_id=$1 AND log_date=$2 AND deleted_at IS NULL ORDER BY created_at",
        [uid, date],
      )
    ).map(normalizeEntry);
    const water = await db.query(
      "SELECT * FROM water_entries WHERE user_id=$1 AND log_date=$2 AND deleted_at IS NULL ORDER BY created_at DESC",
      [uid, date],
    );
    const events = await db.query(
      "SELECT event_key,amount FROM xp_events WHERE user_id=$1 AND log_date=$2",
      [uid, date],
    );
    return {
      date,
      entries,
      water,
      events,
      water_ml: water.reduce((s, e) => s + Number(e.amount_ml), 0),
      consumed: entries.reduce(
        (a, e) => ({
          calories: a.calories + e.calories,
          protein_g: a.protein_g + e.protein_g,
          carbs_g: a.carbs_g + e.carbs_g,
          fat_g: a.fat_g + e.fat_g,
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    };
  });
  app.get("/api/v2/history", auth, async (req) => {
    const { from, to } = z.object({ from: day, to: day }).parse(req.query);
    if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000)
      throw fail(400, "Choose a range of up to one year.");
    return {
      days: await db.query(
        "SELECT log_date AS date,SUM(calories)::float AS calories,SUM(protein_g)::float AS protein_g,COUNT(*)::int AS entries FROM entries_v2 WHERE user_id=$1 AND log_date BETWEEN $2 AND $3 AND deleted_at IS NULL GROUP BY log_date ORDER BY log_date",
        [userId(req), from, to],
      ),
    };
  });
  app.post("/api/v2/check-in", auth, async (req) => {
    const user = await getUser(userId(req));
    const date = localDay(user.timezone);
    return { awarded_xp: await xp(db, user.id, date, "check-in", 10) };
  });
  app.get("/api/v2/progress", auth, async (req) => progress(userId(req)));
  app.get("/api/v2/changes", auth, async (req) => {
    const { since } = z
      .object({
        since: z.string().datetime().default("1970-01-01T00:00:00.000Z"),
      })
      .parse(req.query);
    const uid = userId(req);
    const now = new Date().toISOString();
    return {
      cursor: now,
      entries: (
        await db.query(
          "SELECT * FROM entries_v2 WHERE user_id=$1 AND updated_at>=$2 AND updated_at<=$3",
          [uid, since, now],
        )
      ).map(normalizeEntry),
      water: await db.query(
        "SELECT * FROM water_entries WHERE user_id=$1 AND updated_at>=$2 AND updated_at<=$3",
        [uid, since, now],
      ),
    };
  });
  app.get("/api/v2/foods/custom", auth, async (req) => ({
    foods: await db.query(
      "SELECT * FROM custom_foods WHERE user_id=$1 ORDER BY created_at DESC",
      [userId(req)],
    ),
  }));
  app.put("/api/v2/foods/custom/:id", auth, async (req) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const b = nutrition
      .extend({
        name: z.string().trim().min(1).max(200),
        serving_qty: z.number().positive(),
        serving_unit: z.string().trim().min(1).max(50),
      })
      .parse(req.body);
    await db.query(
      "INSERT INTO custom_foods(id,user_id,name,serving_qty,serving_unit,calories,protein_g,carbs_g,fat_g) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING",
      [
        id,
        userId(req),
        b.name,
        b.serving_qty,
        b.serving_unit,
        b.calories,
        b.protein_g,
        b.carbs_g,
        b.fat_g,
      ],
    );
    return { ok: true };
  });
  return app;
}
