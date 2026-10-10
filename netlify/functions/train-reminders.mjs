import { stores, keys, webpush } from "../lib/push-store.mjs";
import { due, message } from "../lib/train-push.mjs";
export default async function handler() {
  const { subscriptions } = stores(),
    k = await keys(),
    start = Date.now();
  let sent = 0;
  // Scheduled functions have a 30-second budget. Atomic claims avoid duplicate sends.
  for await (const page of subscriptions.list({ paginate: true })) {
    for (let i = 0; i < page.blobs.length; i += 10) {
      if (Date.now() - start > 22000) return;
      await Promise.all(
        page.blobs.slice(i, i + 10).map(async ({ key }) => {
          const entry = await subscriptions.getWithMetadata(key, {
            type: "json",
          });
          if (!entry) return;
          const sub = entry.data;
          if (Date.now() - sub.updatedAt > 90 * 86400000) {
            await subscriptions.delete(key);
            return;
          }
          const date = due(sub);
          if (!date) return;
          const claimed = await subscriptions.setJSON(
            key,
            { ...sub, sentDate: date },
            { onlyIfMatch: entry.etag },
          );
          if (!claimed.modified) return;
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify(message(sub)),
              {
                TTL: 1800,
                timeout: 5000,
                vapidDetails: {
                  subject: process.env.URL || "https://fitkin.example",
                  publicKey: k.publicKey,
                  privateKey: k.privateKey,
                },
              },
            );
            sent++;
          } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410)
              await subscriptions.delete(
                key,
              ); /* Other failures do not retry that day: avoid repeated encouragement. */
          }
        }),
      );
    }
  }
  console.log(JSON.stringify({ sent }));
}
export const config = { schedule: "*/15 * * * *" };
