import { digest, validate } from "../lib/train-push.mjs";
import { stores, keys } from "../lib/push-store.mjs";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export default async function handler(req) {
  try {
    if (req.method === "GET")
      return json({ publicKey: (await keys()).publicKey });
    if (req.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    if (req.headers.get("origin") !== new URL(req.url).origin)
      return json({ error: "Same-origin requests only" }, 403);
    const text = await req.text();
    if (text.length > 8192) return json({ error: "Request too large" }, 413);
    let b;
    try {
      b = validate(JSON.parse(text));
    } catch (e) {
      return json({ error: e.message }, 400);
    }
    const { subscriptions } = stores(),
      hash = digest(b.token),
      id = b.action === "subscribe" ? digest(b.subscription.endpoint) : b.id;
    const current = await subscriptions.getWithMetadata(id, { type: "json" });
    if (current && current.data.tokenHash !== hash)
      return json(
        {
          error:
            "This browser has reminders for another profile. Disable those reminders first.",
        },
        403,
      );
    if (b.action === "unsubscribe") {
      if (current) await subscriptions.delete(id);
      return json({ ok: true });
    }
    if (b.action === "complete") {
      if (!current) return json({ error: "Subscription not found" }, 404);
      const result = await subscriptions.setJSON(
        id,
        { ...current.data, completedDate: b.date, updatedAt: Date.now() },
        { onlyIfMatch: current.etag },
      );
      return json({ ok: result.modified }, result.modified ? 200 : 409);
    }
    const result = await subscriptions.setJSON(
      id,
      {
        subscription: b.subscription,
        tokenHash: hash,
        days: [...new Set(b.days)],
        time: b.time,
        timezone: b.timezone,
        tone: b.tone === "playful" ? "playful" : "gentle",
        updatedAt: Date.now(),
        sentDate: current?.data.sentDate || null,
        completedDate: current?.data.completedDate || null,
      },
      { ...(current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }) },
    );
    return result.modified
      ? json({ ok: true, id })
      : json({ error: "Schedule changed; please try again" }, 409);
  } catch {
    return json(
      {
        error:
          "Reminder service unavailable. Try again or export calendar reminders.",
      },
      503,
    );
  }
}
// Limits subscription churn without collecting health data.
export const config = {
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
