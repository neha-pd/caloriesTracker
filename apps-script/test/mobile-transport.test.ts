import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { createRequire } from "node:module";
import { AxiosHeaders } from "axios";
const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: ["mobile/src/lib/sheets.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["axios"],
  define: {
    "process.env.EXPO_PUBLIC_APPS_SCRIPT_URL": JSON.stringify(
      "https://script.google.com/macros/s/test-deployment/exec",
    ),
    "process.env.EXPO_PUBLIC_FIREBASE_API_KEY": JSON.stringify("public-key"),
  },
  plugins: [
    {
      name: "session",
      setup(b) {
        b.onResolve({ filter: /^\.\/session$/ }, () => ({
          path: "session",
          namespace: "mock",
        }));
        b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents:
            "export async function getSecret(k){return globalThis.secrets[k]||null} export function sessionGeneration(){return globalThis.generation}",
          loader: "js",
        }));
      },
    },
  ],
});
function adapter(handler: (url: string, body: any) => any) {
  const calls: any[] = [],
    context: any = {
      module: { exports: {} },
      require,
      AbortController,
      setTimeout,
      clearTimeout,
      Intl,
      secrets: {
        access_token: "firebase-id-token",
        sheet_session: "app-session",
      },
      generation: 0,
      fetch: async (url: string, options: any) => {
        const body =
          options.headers["Content-Type"] === "application/json"
            ? JSON.parse(options.body)
            : options.body;
        calls.push({ url, body });
        return { status: 200, json: async () => handler(url, body) };
      },
    };
  vm.createContext(context);
  vm.runInContext(compiled.outputFiles[0].text, context);
  return {
    calls,
    context,
    run: (url: string, method = "get", body: any = {}) =>
      context.module.exports.sheetsAdapter({
        url,
        method,
        data: JSON.stringify(body),
        headers: new AxiosHeaders({ "X-Fitkin-Request-Id": "request-one" }),
        timeout: 1000,
      }),
  };
}
test("mobile signs in directly with Firebase and never sends passwords to Sheets", async () => {
  const a = adapter((url) =>
    url.includes("googleapis.com")
      ? { idToken: "new-id-token", refreshToken: "refresh-token" }
      : {
          status: 200,
          data: {
            sheet_session: "new-session",
            user: { id: "existing-app-id" },
          },
        },
  );
  const r = await a.run("/api/auth/login", "post", {
    email: "friend@example.com",
    password: "private-password",
  });
  assert.equal(r.data.user.id, "existing-app-id");
  assert.equal(r.data.token, "new-id-token");
  assert.equal(a.calls.length, 2);
  assert.equal(a.calls[1].body.token, "new-id-token");
  assert.equal(a.calls[1].body.path, "/api/auth/session");
  assert.equal(JSON.stringify(a.calls[1]).includes("private-password"), false);
});
test("logical Apps Script errors become Axios errors with status and preserve operation ID", async () => {
  const a = adapter(() => ({ status: 409, data: { error: "Record changed" } }));
  await assert.rejects(
    a.run("/api/v2/entries/entry", "patch", { version: 1 }),
    (e) => {
      assert.equal((e as any).response.status, 409);
      return true;
    },
  );
  assert.equal(a.calls[0].body.requestId, "request-one");
  assert.equal(a.calls[0].body.session, "app-session");
  assert.equal(a.calls[0].body.method, "PATCH");
});
test("password reset goes to Firebase and a late response after logout is discarded", async () => {
  const a = adapter(() => ({}));
  await a.run("/api/auth/forgot-password", "post", {
    email: "friend@example.com",
  });
  assert.ok(a.calls[0].url.includes("accounts:sendOobCode"));
  assert.equal(a.calls[0].body.requestType, "PASSWORD_RESET");
  const b = adapter(() => {
    b.context.generation++;
    return { status: 200, data: { user: {} } };
  });
  await assert.rejects(
    b.run("/api/users/me"),
    (e) => (e as any).code === "ERR_CANCELED",
  );
});
test("account deletion reauthenticates but never forwards the password to Apps Script", async () => {
  const a = adapter((url) =>
    url.includes("accounts:lookup")
      ? { users: [{ email: "friend@example.com" }] }
      : url.includes("accounts:signInWithPassword")
        ? { idToken: "fresh-token" }
        : { status: 200, data: { ok: true } },
  );
  await a.run("/api/users/me", "delete", { password: "private-password" });
  assert.equal(a.calls[2].body.token, "fresh-token");
  assert.equal(JSON.stringify(a.calls[2]).includes("private-password"), false);
});
