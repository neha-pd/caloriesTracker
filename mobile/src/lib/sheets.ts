import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { getSecret, sessionGeneration } from "./session";
export const SHEETS_URL = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL || "";
const FIREBASE_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  "AIzaSyDsMmb8fF3tBvvCJ8Dy_7uGbp-nY8PQ_RY";
const validEndpoint =
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
function failure(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
): never {
  throw new AxiosError(
    message,
    status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
    config,
    undefined,
    {
      status,
      statusText: String(status),
      data: { error: message },
      headers: {},
      config,
    },
  );
}
async function request(
  url: string,
  body: unknown,
  config: InternalAxiosRequestConfig,
  form = false,
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), config.timeout || 70000);
  const abort = () => controller.abort();
  config.signal?.addEventListener?.("abort", abort);
  try {
    if (config.signal?.aborted) controller.abort();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": form
          ? "application/x-www-form-urlencoded"
          : "application/json",
      },
      body: form ? String(body) : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    return { status: response.status, data };
  } catch {
    throw new AxiosError(
      "Could not connect. Your saved changes will retry when you are online.",
      "ERR_NETWORK",
      config,
    );
  } finally {
    clearTimeout(timer);
    config.signal?.removeEventListener?.("abort", abort);
  }
}
async function firebase(
  action: string,
  body: unknown,
  config: InternalAxiosRequestConfig,
) {
  const r = await request(
    "https://identitytoolkit.googleapis.com/v1/accounts:" +
      action +
      "?key=" +
      FIREBASE_KEY,
    body,
    config,
  );
  if (r.status !== 200) {
    const code = String(r.data.error?.message || "");
    if (action === "sendOobCode" && code === "EMAIL_NOT_FOUND") return {};
    if (code === "EMAIL_EXISTS")
      failure(
        config,
        409,
        "This email already has an account. Please sign in.",
      );
    if (
      /INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|USER_DISABLED|INVALID_ID_TOKEN|TOKEN_EXPIRED/.test(
        code,
      )
    )
      failure(
        config,
        401,
        "Please check your email and password, then sign in again.",
      );
    if (/TOO_MANY|QUOTA/.test(code))
      failure(config, 429, "Too many attempts. Please try again later.");
    if (/WEAK_PASSWORD|INVALID_EMAIL|PASSWORD_DOES_NOT_MEET/.test(code))
      failure(config, 400, "Check your email and choose a stronger password.");
    failure(
      config,
      503,
      "Sign-in is temporarily unavailable. Please try again.",
    );
  }
  return r.data;
}
export async function refreshFirebase(
  refreshToken: string,
  config: InternalAxiosRequestConfig,
) {
  const r = await request(
    "https://securetoken.googleapis.com/v1/token?key=" + FIREBASE_KEY,
    "grant_type=refresh_token&refresh_token=" +
      encodeURIComponent(refreshToken),
    config,
    true,
  );
  if (r.status !== 200)
    failure(config, r.status === 400 ? 401 : 503, "Please sign in again.");
  return { token: r.data.id_token, refresh_token: r.data.refresh_token };
}
export async function rpc(
  config: InternalAxiosRequestConfig,
  token: string | null,
  session: string | null,
  path: string,
  method: string,
  body: unknown,
) {
  if (!validEndpoint.test(SHEETS_URL))
    failure(
      config,
      503,
      "This build needs its Google backend address. Please install the configured Fitkin APK.",
    );
  const r = await request(
    SHEETS_URL,
    {
      protocol: 1,
      path,
      method,
      body,
      token,
      session,
      requestId: config.headers.get("X-Fitkin-Request-Id"),
    },
    config,
  );
  if (
    r.status !== 200 ||
    !Number.isInteger(r.data.status) ||
    !("data" in r.data)
  )
    failure(
      config,
      503,
      "Sync is temporarily unavailable. Your saved data is still here.",
    );
  if (r.data.status >= 400)
    failure(config, r.data.status, r.data.data?.error || "Please try again.");
  return r.data.data;
}
export const sheetsAdapter: AxiosAdapter = async (config) => {
  const generation = sessionGeneration(),
    path = (config.url || "").split("?")[0],
    method = (config.method || "get").toUpperCase(),
    body =
      typeof config.data === "string"
        ? JSON.parse(config.data)
        : config.data || {};
  let token = await getSecret("access_token"),
    session = await getSecret("sheet_session"),
    data: any;
  if (path === "/api/auth/login" || path === "/api/auth/register") {
    const account = await firebase(
      path.endsWith("register") ? "signUp" : "signInWithPassword",
      {
        email: String(body.email).trim(),
        password: body.password,
        returnSecureToken: true,
      },
      config,
    );
    const connected = await rpc(
      config,
      account.idToken,
      null,
      "/api/auth/session",
      "POST",
      {
        display_name: body.display_name || "Friend",
        timezone:
          body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    );
    if (connected.accountDeleted)
      failure(config, 401, "Your account deletion is complete.");
    data = {
      ...connected,
      token: account.idToken,
      refresh_token: account.refreshToken,
    };
  } else if (path === "/api/auth/forgot-password") {
    await firebase(
      "sendOobCode",
      { requestType: "PASSWORD_RESET", email: body.email },
      config,
    );
    data = {
      message: "If that email has an account, a reset link is on its way.",
    };
  } else if (path === "/api/auth/reset-password") {
    await firebase(
      "resetPassword",
      { oobCode: body.token, newPassword: body.password },
      config,
    );
    data = { ok: true };
  } else if (path === "/api/auth/google") {
    failure(
      config,
      400,
      "Use email and password to sign in to this Fitkin build.",
    );
  } else {
    if (path === "/api/users/me" && method === "DELETE") {
      const account = await firebase("lookup", { idToken: token }, config);
      const fresh = await firebase(
        "signInWithPassword",
        {
          email: account.users[0].email,
          password: body.password,
          returnSecureToken: true,
        },
        config,
      );
      token = fresh.idToken;
    }
    data = await rpc(
      config,
      token,
      session,
      path,
      method,
      path === "/api/users/me" && method === "DELETE" ? {} : body,
    );
  }
  if (generation !== sessionGeneration())
    throw new AxiosError("Session ended", "ERR_CANCELED", config);
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
