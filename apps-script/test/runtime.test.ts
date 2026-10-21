import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { recordSummary } from "../src/migration";
const bundle = fs.readFileSync(
  new URL("../dist/Code.gs", import.meta.url),
  "utf8",
);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function runtime() {
  const props = new Map(
    Object.entries({
      OWNER_EMAIL: "owner@example.com",
      FIREBASE_PROJECT_ID: "fitlens-b37f6",
      FIREBASE_API_KEY: "public-key",
      SPREADSHEET_ID: "private-sheet",
      MIGRATION_STATUS: "ready",
    }),
  );
  let rows: any[][] = [["kind", "record_id", "owner_id", "record_json"]],
    cachedRows: any[][] | undefined,
    max = 1000,
    failCommit = false,
    active = "owner@example.com",
    validSince = 0,
    googleAccepts = true,
    held = false;
  const batches: any[] = [],
    urls: string[] = [];
  const sheet = {
    getLastRow: () => (cachedRows || rows).length,
    getMaxRows: () => max,
    getSheetId: () => 1,
    getRange: (start: number, _col: number, count: number) => ({
      getValues: () => (cachedRows || rows).slice(start - 1, start - 1 + count),
    }),
  };
  const context: any = {
    URL,
    Date,
    Intl,
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) || null,
        deleteProperty: (k: string) => props.delete(k),
        setProperty: (k: string, v: string) => {
          props.set(k, v);
        },
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => active }),
      getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => null,
      openById: () => ({ getSheetByName: () => sheet }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          assert.equal(held, false);
          held = true;
          return true;
        },
        releaseLock: () => {
          held = false;
        },
      }),
    },
    Utilities: {
      getUuid: randomUUID,
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (_a: string, s: string) => [
        ...createHash("sha256").update(s).digest(),
      ],
      base64DecodeWebSafe: (s: string) => Buffer.from(s, "base64url"),
      newBlob: (b: Buffer) => ({ getDataAsString: () => b.toString() }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({
        setMimeType: () => JSON.parse(text),
      }),
    },
    Sheets: {
      Spreadsheets: {
        Values: {
          get: () => ({ values: structuredClone(rows.slice(1)) }),
        },
        batchUpdate: (body: any) => {
          assert.equal(held, true);
          if (failCommit) throw Error("quota");
          batches.push(body);
          const next = structuredClone(rows);
          for (const req of body.requests)
            if (req.updateCells) {
              const u = req.updateCells;
              next[u.range.startRowIndex] = u.rows[0].values.map(
                (v: any) => v.userEnteredValue.stringValue,
              );
            } else if (req.appendDimension) max += req.appendDimension.length;
          rows = next;
        },
      },
    },
    UrlFetchApp: {
      fetch: (url: string, options: any) => {
        urls.push(url);
        if (url.includes("accounts:lookup"))
          return {
            getResponseCode: () => (googleAccepts ? 200 : 400),
            getContentText: () =>
              JSON.stringify(
                googleAccepts
                  ? {
                      users: [
                        {
                          localId: "firebase-a",
                          email: "person@example.com",
                          validSince,
                        },
                      ],
                    }
                  : { error: { message: "INVALID_ID_TOKEN" } },
              ),
          };
        if (url.includes("accounts:delete"))
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({}),
          };
        if (url.includes("openrouter.ai")) {
          assert.equal(held, false, "inference must not hold the storage lock");
          return {
            getResponseCode: () => 200,
            getContentText: () =>
              JSON.stringify({
                model: "liquid/lfm-2.5-2.6b:free",
                choices: [{ message: { content: '{"reply":"Hello!"}' } }],
              }),
          };
        }
        throw Error("Unexpected URL");
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(bundle, context);
  const token = (overrides: any = {}) =>
    "header." +
    Buffer.from(
      JSON.stringify({
        sub: "firebase-a",
        aud: "fitlens-b37f6",
        iss: "https://securetoken.google.com/fitlens-b37f6",
        exp: Date.now() / 1000 + 3600,
        auth_time: Math.floor(Date.now() / 1000),
        ...overrides,
      }),
    ).toString("base64url") +
    ".signature";
  const post = (req: any) => {
    cachedRows = structuredClone(rows);
    return context.doPost({
      postData: {
        contents: JSON.stringify({
          protocol: 1,
          method: "GET",
          path: "/api/users/me",
          token: token(),
          ...req,
        }),
      },
    });
  };
  return {
    context,
    post,
    token,
    props,
    rows: () => rows,
    batches,
    urls,
    fail: (v: boolean) => {
      failCommit = v;
    },
    active: (v: string) => {
      active = v;
    },
    revoke: () => {
      validSince = Date.now() / 1000 + 10;
    },
    rejectToken: () => {
      googleAccepts = false;
    },
  };
}
test("bundled Apps Script verifies tokens with Google and rejects wrong audience, expiry and revocation", () => {
  const r = runtime();
  assert.equal(r.post({ token: r.token({ aud: "other" }) }).status, 401);
  assert.equal(r.urls.length, 0);
  assert.equal(r.post({ token: r.token({ exp: 1 }) }).status, 401);
  r.rejectToken();
  assert.equal(r.post({}).status, 401);
  assert.equal(r.rows().length, 1);
  const r2 = runtime();
  r2.revoke();
  assert.equal(r2.post({}).status, 401);
});
test("bundle authenticates, writes atomically, recovers from failed writes and encodes formula-like names as strings", () => {
  const r = runtime(),
    login = r.post({
      method: "POST",
      path: "/api/auth/session",
      body: { display_name: '=IMPORTXML("x")', timezone: "UTC" },
    });
  assert.equal(login.status, 200);
  assert.ok(login.data.sheet_session);
  const session = login.data.sheet_session,
    id = randomUUID(),
    requestId = randomUUID(),
    body = {
      id,
      log_date: "2026-10-21",
      name: '=HYPERLINK("x")',
      meal_type: "lunch",
      quantity: 1,
      serving_unit: "bowl",
      base_nutrition: { calories: 100, protein_g: 5, carbs_g: 10, fat_g: 5 },
      calories: 100,
      protein_g: 5,
      carbs_g: 10,
      fat_g: 5,
    };
  const request = {
    session,
    method: "PUT",
    path: "/api/v2/entries/" + id,
    requestId,
    body,
  };
  const before = JSON.stringify(r.rows());
  r.fail(true);
  assert.equal(r.post(request).status, 503);
  assert.equal(JSON.stringify(r.rows()), before);
  r.fail(false);
  assert.equal(r.post(request).status, 200);
  const after = JSON.stringify(r.rows());
  assert.equal(r.post(request).status, 200);
  assert.equal(JSON.stringify(r.rows()), after);
  const snapshot = r.post({ session, path: "/api/v3/snapshot" });
  assert.equal(snapshot.data.entries.length, 1);
  assert.ok(
    r.batches
      .flatMap((b) => b.requests)
      .filter((x: any) => x.updateCells)
      .every((x: any) =>
        x.updateCells.rows[0].values.every(
          (v: any) => "stringValue" in v.userEnteredValue,
        ),
      ),
  );
});
test("anonymous callers cannot import or activate; migration pause blocks all app requests", () => {
  const r = runtime();
  r.active("");
  assert.throws(
    () => r.context.beginFitkinImport({}),
    /Only the configured owner/,
  );
  assert.throws(() => r.context.activateFitkin(), /Only the configured owner/);
  r.props.set("MIGRATION_STATUS", "importing");
  assert.equal(
    r.post({ method: "POST", path: "/api/auth/session" }).status,
    503,
  );
});
test("browser import resumes same batches, verifies full digest and only then activates", () => {
  const r = runtime();
  r.props.set("MIGRATION_STATUS", "waiting");
  const id = randomUUID(),
    rows = [
      {
        kind: "user",
        id,
        owner: "firebase-a",
        value: {
          id,
          firebase_uid: "firebase-a",
          email: "person@example.com",
          display_name: "Friend",
          timezone: "UTC",
          settings: {},
        },
      },
    ];
  const manifest = { schema: 1, summary: recordSummary(rows, hash) };
  r.context.beginFitkinImport(manifest);
  r.context.importFitkinBatch(rows);
  r.context.importFitkinBatch(rows);
  assert.equal(r.rows().length, 2);
  assert.equal(r.context.finishFitkinImport().verified, true);
  assert.equal(r.context.doGet().data.ready, false);
  r.context.activateFitkin();
  assert.equal(r.context.doGet().data.ready, true);
  assert.throws(() => r.context.beginFitkinImport(manifest), /Live data/);
});
test("missing or corrupted import data never becomes a ready backend", () => {
  const r = runtime();
  r.props.set("MIGRATION_STATUS", "waiting");
  r.context.beginFitkinImport({
    schema: 1,
    summary: { count: 1, digest: "a".repeat(64) },
  });
  assert.throws(() => r.context.finishFitkinImport(), /Verification failed/);
  assert.throws(() => r.context.activateFitkin(), /Verify/);
  assert.equal(r.context.doGet().data.ready, false);
});

test("standalone editor import verifies before replacement and cannot replace live data", () => {
  const r = runtime();
  r.props.set("MIGRATION_STATUS", "waiting");
  const id = randomUUID(),
    rows = [
      {
        kind: "user",
        id,
        owner: "firebase-a",
        value: { id, firebase_uid: "firebase-a", email: "person@example.com" },
      },
    ],
    snapshot = {
      manifest: { schema: 1, summary: recordSummary(rows, hash) },
      rows,
    };
  assert.equal(r.context.Fitkin.importSnapshot(snapshot).verified, true);
  const before = JSON.stringify(r.rows());
  const bad = structuredClone(snapshot);
  bad.rows[0].value.email = "changed@example.com";
  assert.throws(
    () => r.context.Fitkin.importSnapshot(bad, true),
    /verification/,
  );
  assert.equal(JSON.stringify(r.rows()), before);
  assert.equal(r.context.Fitkin.importSnapshot(snapshot, true).verified, true);
  r.context.activateFitkin();
  assert.throws(
    () => r.context.Fitkin.importSnapshot(snapshot, true),
    /live backend/,
  );
  assert.equal(r.props.get("MIGRATION_STATUS"), "ready");
});

// SpreadsheetApp can keep an execution-local read cache after advanced Sheets
// writes. The two lock phases of chat must re-read committed records.
test("chat finalizes and replays its receipt even with stale SpreadsheetApp reads", () => {
  const r = runtime();
  r.props.set("OPENROUTER_API_KEY", "test-only");
  const login = r.post({ method: "POST", path: "/api/auth/session" });
  assert.equal(login.status, 200);
  const req = {
    session: login.data.sheet_session,
    method: "POST",
    path: "/api/v2/chat",
    requestId: randomUUID(),
    body: {
      date: "2026-10-21",
      includeDiary: false,
      messages: [{ role: "user", content: "Hello" }],
    },
  };
  const reply = r.post(req);
  assert.equal(reply.status, 200, JSON.stringify(reply.data));
  assert.equal(reply.data.reply, "Hello!");
  assert.deepEqual(r.post(req), reply);
  assert.equal(r.urls.filter((url) => url.includes("openrouter.ai")).length, 1);
});

test("batch uses one verified request and atomic write, and a failed commit safely replays", () => {
  const r = runtime();
  const login = r.post({ method: "POST", path: "/api/auth/session" });
  const req = {
    session: login.data.sheet_session,
    method: "POST",
    path: "/api/v3/batch",
    body: {
      operations: Array.from({ length: 3 }, () => ({
        method: "PUT",
        path: "/api/v2/water/" + randomUUID(),
        requestId: randomUUID(),
        body: { log_date: "2026-10-21", amount_ml: 250 },
      })),
    },
  };
  const before = JSON.stringify(r.rows());
  r.fail(true);
  assert.equal(r.post(req).status, 503);
  assert.equal(JSON.stringify(r.rows()), before);
  r.fail(false);
  const writes = r.batches.length,
    auth = r.urls.length;
  const response = r.post(req);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.results.length, 3);
  assert.equal(response.data.snapshot.water.length, 3);
  assert.equal(r.batches.length - writes, 1);
  assert.equal(r.urls.length - auth, 1);
  const saved = JSON.stringify(r.rows());
  assert.equal(r.post(req).status, 200);
  assert.equal(JSON.stringify(r.rows()), saved);
});

test("admin HTML is bundled into Code.gs while normal GET stays compatible JSON", () => {
  const r = runtime();
  r.context.HtmlService = {
    createHtmlOutput: (html: string) => {
      const page = { html, setTitle: () => page, addMetaTag: () => page };
      return page;
    },
  };
  const page = r.context.doGet({ parameter: { view: "admin" } });
  assert.match(page.html, /getFitkinDashboardData/);
  assert.match(page.html, /How fast is the API/);
  assert(!page.html.includes("private-sheet"));
  assert.equal(r.context.doGet().data.backend, "google-sheets");
  r.active("stranger@example.com");
  assert.throws(
    () => r.context.getFitkinDashboardData({ refresh: true }),
    /Only the configured owner/,
  );
});
