import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/core/database.js";
import { createApp } from "../src/app.js";
import type { FirebaseAccounts } from "../src/core/firebase.js";
test("Firebase accounts preserve app sessions, reject revoked tokens, and delete both identities", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  let revoked = false, removed = false, recovered = "";
  const identity = { uid: "firebase-test-uid", email: "firebase@example.com", authTime: 1234 };
  const firebase: FirebaseAccounts = {
    register: async () => identity,
    login: async (_email, password) => {
      if (password !== "Secure-pass-123") throw Object.assign(new Error("Incorrect password"), { statusCode: 401 });
      return identity;
    },
    assertSession: async (uid, time) => {
      assert.equal(uid, identity.uid); assert.equal(time, identity.authTime);
      if (revoked) throw Object.assign(new Error("Session revoked"), { statusCode: 401 });
    },
    recover: async (email) => { recovered = email; },
    remove: async (uid) => { assert.equal(uid, identity.uid); removed = true; },
  };
  const app = await createApp({ db, secret: "firebase-unit-tests-secret-minimum-32-characters", firebase, testing: true });
  const call = async (method: any, url: string, payload?: any, token?: string) => {
    const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.statusCode, body: response.json() };
  };
  try {
    const reg = await call("POST", "/api/auth/register", { email: identity.email, password: "Secure-pass-123", display_name: "Firebase Tester" });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const token = reg.body.token;
    const [stored] = await db.query("SELECT * FROM users WHERE id=$1", [reg.body.user.id]);
    assert.equal(stored.firebase_uid, identity.uid); assert.equal(stored.password_hash, null);
    assert.equal((await call("GET", "/api/users/me", undefined, token)).status, 200);
    const recovery = await call("POST", "/api/auth/forgot-password", { email: identity.email });
    assert.equal(recovery.body.mode, "email_link"); assert.equal(recovered, identity.email);
    revoked = true;
    assert.equal((await call("GET", "/api/users/me", undefined, token)).status, 401);
    assert.equal((await call("POST", "/api/auth/refresh", { refresh_token: reg.body.refresh_token })).status, 401);
    revoked = false;
    const login = await call("POST", "/api/auth/login", { email: identity.email, password: "Secure-pass-123" });
    assert.equal(login.body.user.id, reg.body.user.id);
    assert.equal((await call("DELETE", "/api/users/me", { password: "Wrong-pass-123" }, login.body.token)).status, 401);
    assert.equal(removed, false);
    assert.equal((await call("DELETE", "/api/users/me", { password: "Secure-pass-123" }, login.body.token)).status, 200);
    assert.equal(removed, true);
    assert.equal((await db.query("SELECT id FROM users")).length, 0);
    assert.equal((await call("GET", "/api/users/me", undefined, token)).status, 401);
  } finally { await app.close(); await db.close(); }
});

test("liveness and keep-awake probes never query the database", async () => {
  let queries = 0;
  const db = {
    query: async () => { queries++; throw new Error("database asleep"); },
    transaction: async () => { throw new Error("not expected"); },
    close: async () => {},
  };
  const app = await createApp({ db, secret: "liveness-tests-secret-at-least-32-characters", testing: true });
  try {
    for (const url of ["/health", "/ping"]) assert.equal((await app.inject({ method: "GET", url })).statusCode, 200);
    assert.equal(queries, 0);
    assert.equal((await app.inject({ method: "GET", url: "/ready" })).statusCode, 500);
    assert.equal(queries, 1);
  } finally { await app.close(); }
});
