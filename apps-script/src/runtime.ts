import { Store, fail, type Row } from "./store";
import { execute, type Identity, type Request } from "./core";
import { FREE_MODELS, parseChatAnswer, chatSystem } from "../../shared/chat";
// Apps Script globals are supplied by Google. No Node server or service-account private key is needed.
declare const PropertiesService: any,
  SpreadsheetApp: any,
  UrlFetchApp: any,
  Utilities: any,
  LockService: any,
  ContentService: any,
  Sheets: any,
  Session: any;
const properties = () => PropertiesService.getScriptProperties();
const property = (key: string) => {
  const value = properties().getProperty(key);
  if (!value) fail(503, "Fitkin setup is incomplete.");
  return value as string;
};
const hash = (s: string) =>
  Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    s,
    Utilities.Charset.UTF_8,
  )
    .map((b: number) => ((b + 256) % 256).toString(16).padStart(2, "0"))
    .join("");
function fetchJSON(url: string, body?: unknown, bearer?: string) {
  let res: any;
  try {
    res = UrlFetchApp.fetch(url, {
      method: body === undefined ? "get" : "post",
      contentType: "application/json",
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: bearer ? { Authorization: "Bearer " + bearer } : {},
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch {
    fail(503, "The service is temporarily unavailable. Try again.");
  }
  let data: any;
  try {
    data = JSON.parse(res.getContentText());
  } catch {
    fail(503, "The service returned an invalid response.");
  }
  return { status: res.getResponseCode(), data };
}
function identity(token: unknown): Identity {
  if (typeof token !== "string" || token.length > 16000)
    fail(401, "Please sign in again.");
  let claims: any;
  try {
    claims = JSON.parse(
      Utilities.newBlob(
        Utilities.base64DecodeWebSafe(token.split(".")[1]),
      ).getDataAsString(),
    );
  } catch {
    fail(401, "Please sign in again.");
  }
  const project = property("FIREBASE_PROJECT_ID");
  if (
    claims.aud !== project ||
    claims.iss !== "https://securetoken.google.com/" + project ||
    !Number.isFinite(claims.exp) ||
    claims.exp * 1000 <= Date.now() ||
    !Number.isFinite(claims.auth_time)
  )
    fail(401, "Please sign in again.");
  // Google verifies the ID token; decoded claims alone never establish identity.
  const { status, data } = fetchJSON(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      encodeURIComponent(property("FIREBASE_API_KEY")),
    { idToken: token },
  );
  if (status >= 500 || status === 429)
    fail(503, "Sign-in verification is temporarily unavailable.");
  const u = data.users?.[0];
  if (
    status !== 200 ||
    !u ||
    u.disabled ||
    u.localId !== claims.sub ||
    claims.auth_time < Number(u.validSince || 0)
  )
    fail(401, "Your session has ended. Please sign in again.");
  if (!u.email) fail(401, "An email account is required.");
  return {
    uid: u.localId,
    email: String(u.email).toLowerCase(),
    authTime: claims.auth_time,
  };
}
export function load() {
  const book = SpreadsheetApp.openById(property("SPREADSHEET_ID")),
    sheet = book.getSheetByName("Records");
  if (!sheet) fail(503, "Fitkin storage has not been initialized.");
  // Read through the same Sheets API used by commit. SpreadsheetApp can
  // retain stale values within one execution, including chat's second lock.
  const rows: any[][] =
      Sheets.Spreadsheets.Values.get(
        property("SPREADSHEET_ID"),
        "Records!A2:D",
        {
          valueRenderOption: "UNFORMATTED_VALUE",
        },
      ).values || [],
    positions = new Map<string, number>(),
    records: Row[] = [];
  rows.forEach((r: any[], i: number) => {
    if (!r[0]) return;
    let value: any;
    try {
      value = JSON.parse(r[3]);
    } catch {
      fail(503, "Stored records need administrator review.");
    }
    const key = r[0] + ":" + r[1];
    if (positions.has(key))
      fail(503, "Duplicate storage keys need administrator review.");
    positions.set(key, i + 2);
    records.push({ kind: r[0], id: r[1], owner: r[2], value });
  });
  return {
    sheet,
    store: new Store(records),
    positions,
    nextRow: rows.length + 2,
  };
}
function commit(state: ReturnType<typeof load>) {
  const { store, sheet, positions } = state;
  if (!store.dirty.size) return;
  let next = state.nextRow;
  const requests: any[] = [];
  for (const [key, row] of store.dirty) {
    const index = positions.get(key) || next++;
    const cells = row
      ? [row.kind, row.id, row.owner, JSON.stringify(row.value)]
      : ["", "", "", ""];
    if (cells[3].length > 45000) fail(413, "This record is too large to sync.");
    requests.push({
      updateCells: {
        range: {
          sheetId: sheet.getSheetId(),
          startRowIndex: index - 1,
          endRowIndex: index,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        rows: [
          {
            values: cells.map((value) => ({
              userEnteredValue: { stringValue: value },
            })),
          },
        ],
        fields: "userEnteredValue",
      },
    });
  }
  if (next - 1 > sheet.getMaxRows())
    requests.unshift({
      appendDimension: {
        sheetId: sheet.getSheetId(),
        dimension: "ROWS",
        length: next - 1 - sheet.getMaxRows(),
      },
    });
  // One atomic Sheets request commits records, XP and idempotency receipts together.
  try {
    Sheets.Spreadsheets.batchUpdate({ requests }, property("SPREADSHEET_ID"));
  } catch {
    fail(503, "Sync could not finish. Your device will retry safely.");
  }
}

export function locked<T>(fn: (state: ReturnType<typeof load>) => T) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000))
    fail(503, "Sync is busy. Your saved changes will retry.");
  try {
    const state = load(),
      result = fn(state);
    commit(state);
    return result;
  } finally {
    lock.releaseLock();
  }
}
function answer(messages: any, context: any) {
  const key = property("OPENROUTER_API_KEY");
  for (let attempt = 0; attempt < 2; attempt++) {
    const models = attempt
      ? [...FREE_MODELS.slice(1), FREE_MODELS[0]]
      : FREE_MODELS;
    const r = fetchJSON(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        models,
        route: "fallback",
        provider: {
          max_price: { prompt: 0, completion: 0, request: 0 },
          allow_fallbacks: true,
        },
        messages: [
          { role: "system", content: chatSystem(context) },
          ...messages,
        ],
        max_tokens: 1200,
        temperature: 0.4,
        reasoning: { exclude: true },
      },
      key,
    );
    if (r.status !== 200)
      fail(
        r.status === 429 ? 429 : 503,
        "Free chat is busy or unavailable. Please try later.",
      );
    try {
      if (!FREE_MODELS.includes(r.data.model)) throw Error();
      return {
        ...parseChatAnswer(r.data.choices[0].message.content),
        model: r.data.model,
      };
    } catch {
      if (attempt)
        fail(503, "Kin could not form a usable reply. Please try rephrasing.");
    }
  }
  fail(503, "Free chat is unavailable.");
}
const services = () => ({
  now: () => Date.now(),
  uuid: () => Utilities.getUuid(),
  hash,
  chatAvailable: !!properties().getProperty("OPENROUTER_API_KEY"),
  chat: (messages: any, context: any) => ({
    pendingChat: true,
    messages,
    context,
  }),
});
function response(status: number, data: any) {
  return ContentService.createTextOutput(
    JSON.stringify({ status, data }),
  ).setMimeType(ContentService.MimeType.JSON);
}
export function post(e: any) {
  try {
    const text = e?.postData?.contents;
    if (typeof text !== "string" || text.length > 96000)
      fail(413, "Request is too large.");
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      fail(400, "Invalid request.");
    }
    if (
      body.protocol !== 1 ||
      typeof body.path !== "string" ||
      body.path.length > 200 ||
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(body.method)
    )
      fail(400, "Unsupported request.");
    if (properties().getProperty("MIGRATION_STATUS") !== "ready")
      fail(503, "Fitkin is being prepared. Please try again shortly.");
    const who = identity(body.token),
      req: Request = {
        method: body.method,
        path: body.path,
        body: body.body,
        session: body.session,
        requestId: body.requestId,
      };
    let result = locked((state) => execute(state.store, who, req, services()));
    if (result.pendingChat) {
      // Do not hold the spreadsheet lock while waiting for inference.
      try {
        const completed = answer(result.messages, result.context);
        result = locked((state) => {
          const user = [...state.store.rows.values()].find(
            (r) => r.kind === "user" && r.owner === who.uid,
          );
          if (!user || user.value.deleting)
            fail(401, "Account is no longer available.");
          const session = state.store.get("session", hash(req.session || ""));
          if (!session || session.owner !== user.id)
            fail(401, "Your session has ended.");
          const receiptId = user.id + "|" + req.requestId,
            receipt = state.store.get("receipt", receiptId);
          if (!receipt) fail(409, "Please send your message again.");
          state.store.put("receipt", receiptId, user.id, {
            ...receipt.value,
            pending: false,
            response: completed,
          });
          return completed;
        });
      } catch (error) {
        locked((state) => {
          const user = [...state.store.rows.values()].find(
            (r) => r.kind === "user" && r.owner === who.uid,
          );
          if (user)
            state.store.remove("receipt", user.id + "|" + req.requestId);
        });
        throw error;
      }
    }
    if (result.deleteFirebase) {
      const r = fetchJSON(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=" +
          encodeURIComponent(property("FIREBASE_API_KEY")),
        { idToken: body.token },
      );
      if (r.status !== 200 && r.data.error?.message !== "USER_NOT_FOUND")
        fail(
          503,
          "Your Fitkin records were removed, but sign-in deletion needs a retry. Please try deleting again.",
        );
      locked((state) => {
        const user = [...state.store.rows.values()].find(
          (r) => r.kind === "user" && r.owner === who.uid,
        );
        if (user) state.store.removeOwner(user.id);
      });
      result = { ok: true, accountDeleted: true };
    }
    return response(200, result);
  } catch (e: any) {
    const status = e.name === "ZodError" ? 400 : e.status || 500;
    return response(status, {
      error:
        status === 500
          ? "Fitkin could not finish this request. Please try again."
          : e.name === "ZodError"
            ? "Please check your details: " +
              e.issues
                .map((i: any) => i.path.join(".") + " " + i.message)
                .join("; ")
            : e.message,
    });
  }
}
export function get() {
  return response(200, {
    service: "Fitkin",
    backend: "google-sheets",
    revision: "2.7.0-sheets.2",
    protocol: 1,
    apkOnly: true,
    ready: properties().getProperty("MIGRATION_STATUS") === "ready",
  });
}
export {
  setup,
  showMigration,
  importBatch,
  beginImport,
  finishImport,
  migrationStatus,
  activate,
  menu,
  showStatus,
  resetStaged,
  importSnapshot,
} from "./admin";
