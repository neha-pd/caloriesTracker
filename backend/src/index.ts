import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { openDatabase, migrate } from "./core/database.js";
import { firebaseAccounts } from "./core/firebase.js";
import { createApp } from "./app.js";
let secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV !== "production") {
  await mkdir(".data", { recursive: true });
  try {
    secret = await readFile(".data/session-secret", "utf8");
  } catch {
    secret = randomBytes(48).toString("hex");
    await writeFile(".data/session-secret", secret, { mode: 0o600 });
  }
}
if (!secret)
  throw new Error(
    "Set JWT_SECRET to a random value of at least 32 characters.",
  );
const db = await openDatabase(process.env.DATABASE_URL);
await migrate(db);
const sendRecovery = process.env.RESEND_API_KEY
  ? async (email: string, token: string) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [email],
          subject: "Reset your FitLens password",
          text: `Your FitLens recovery code is:\n\n${token}\n\nEnter it in the app within 30 minutes. If you did not request this, ignore this email.`,
        }),
      });
      if (!response.ok) throw new Error("Recovery email delivery failed.");
    }
  : undefined;
const app = await createApp({
  db,
  secret,
  sendRecovery,
  firebase: firebaseAccounts(),
  testing: process.env.NODE_ENV === "test",
});
app.addHook("onClose", () => db.close());
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void app.close().then(() => process.exit(0)));
