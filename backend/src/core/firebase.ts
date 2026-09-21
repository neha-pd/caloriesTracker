import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
export interface FirebaseIdentity { uid: string; email: string; authTime: number }
export interface FirebaseAccounts {
  register(email: string, password: string): Promise<FirebaseIdentity>;
  login(email: string, password: string): Promise<FirebaseIdentity>;
  assertSession(uid: string, authTime: number): Promise<void>;
  recover(email: string): Promise<void>;
  remove(uid: string): Promise<void>;
}
const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
export function firebaseAccounts(): FirebaseAccounts | undefined {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return undefined;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS ? readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8") : "");
  if (!credentials) throw new Error("Firebase service account is required when FIREBASE_API_KEY is configured.");
  const serviceAccount = JSON.parse(credentials);
  if (process.env.FIREBASE_PROJECT_ID && serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID)
    throw new Error("Firebase service account belongs to a different project.");
  const auth = getAuth(initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, "fitlens"));
  async function request(action: string, body: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey!)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
    } catch { throw fail(503, "Account service is temporarily unavailable. Please try again."); }
    const data = await response.json() as any;
    if (!response.ok) {
      const code = String(data.error?.message || "").split(" : ")[0];
      if (action === "sendOobCode" && code === "EMAIL_NOT_FOUND") return {};
      if (code === "EMAIL_EXISTS") throw fail(409, "This email already has an account. Try logging in.");
      if (["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "USER_DISABLED"].includes(code)) throw fail(401, "Email or password is incorrect.");
      if (code === "TOO_MANY_ATTEMPTS_TRY_LATER" || code === "QUOTA_EXCEEDED") throw fail(429, "Too many requests. Please try again later.");
      if (code.startsWith("WEAK_PASSWORD") || code === "PASSWORD_DOES_NOT_MEET_REQUIREMENTS") throw fail(400, "Choose a stronger password.");
      if (code === "INVALID_EMAIL") throw fail(400, "Enter a valid email address.");
      throw fail(503, "Account service is not available. Check Email/Password sign-in configuration.");
    }
    return data;
  }
  async function authenticate(action: string, email: string, password: string) {
    const data = await request(action, { email, password, returnSecureToken: true });
    const token = await auth.verifyIdToken(data.idToken, true);
    if (!token.email) throw fail(401, "Account email is missing.");
    return { uid: token.uid, email: token.email.toLowerCase(), authTime: token.auth_time };
  }
  return {
    register: (email, password) => authenticate("signUp", email, password),
    login: (email, password) => authenticate("signInWithPassword", email, password),
    async assertSession(uid, authTime) {
      try {
        const user = await auth.getUser(uid);
        const validAfter = Date.parse(user.tokensValidAfterTime || "1970-01-01T00:00:00Z") / 1000;
        if (user.disabled || !Number.isFinite(authTime) || authTime < validAfter) throw fail(401, "Your session has ended. Please sign in again.");
      } catch (e: any) {
        if (e.statusCode === 401 || e.code === "auth/user-not-found") throw fail(401, "Your session has ended. Please sign in again.");
        throw fail(503, "Account service is temporarily unavailable. Please try again.");
      }
    },
    recover: async (email) => { await request("sendOobCode", { requestType: "PASSWORD_RESET", email }); },
    remove: async (uid) => { await auth.deleteUser(uid); },
  };
}
