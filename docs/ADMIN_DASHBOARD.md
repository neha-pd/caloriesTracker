# Private Sheets admin dashboard

The existing spreadsheet remains the sole data store. New operational tabs sit beside **Records**; no migration or second spreadsheet is needed.

## Update an existing deployment

1. Run `npm run build:backend` locally.
2. Replace **Code.gs** and **appsscript.json** in the owner's Apps Script editor with `apps-script/dist` copies. Code.js is an identical alternative to Code.gs; paste only one.
3. Save, select **setupFitkinDashboard**, run it and approve Google's added trigger permission.
4. Choose **Deploy → Manage deployments → Edit → New version → Deploy**, retaining the existing URL. Saving the editor alone does not publish API changes.
5. Open the spreadsheet. **Admin** is the overview; the setup installs one five-minute refresh trigger. **refreshFitkinDashboard** can also be run manually by the owner.

Do **not** re-import data or run activateFitkin again. Setup preserves app records. Keep the whole spreadsheet Restricted; hidden tabs are not an access-control boundary. Admin functions are editor-only and not public RPC routes.

## Tabs

| Tab | Contents |
| --- | --- |
| Admin | Account, food, workout and water counts; recent requests/errors; median and p95 server processing time; usage and latency charts. |
| Daily Usage | Unique account hashes observed, requests, failures, mutation operations and latency percentiles by UTC day. |
| API Requests | Timestamp, normalized route, logical response status, server/lock/read/write timing, operations, rejected operations and account hash. |
| Storage | Counts by record kind, including retry receipts and hashed app sessions. |
| Read Me | Coverage, privacy, retention and refresh instructions. |
| Records | Existing private application data. Never manually sort, edit or delete rows here. |

## Reading the numbers

Server time begins when the Apps Script handler starts and ends after request processing. It includes authentication and storage work, but excludes Google's request startup, network transfer and client rendering. It is **not** the full time a user waits. Logical status is recorded because Apps Script wraps API errors in a JSON envelope.

Request metrics are best-effort: they are briefly buffered to avoid extra spreadsheet writes on every user request. Cache eviction, contention, a failed flush or quota limits can omit observations. The latest 5,000 samples from up to 14 days are retained; charts summarize those samples. There are no historical timings before enabling this feature. Demo use, offline actions and local Train sessions are not usage events. Account totals count app profiles, not all Firebase-only identities.

No tokens, emails, chat prompts or meal contents enter these metrics. Account hashes are still private operational metadata. The original Records tab continues to contain private user data.

## Responsive sync

The app persists food, water and activity changes locally before starting network work. Up to 20 queued changes share one authenticated request, one storage lock/read and one atomic Sheets write. Each item retains its retry ID; invalid/conflicting items have individual errors. The response includes a current snapshot, avoiding another read after a successful batch. Older deployed scripts fall back to individual requests during rollout.

Dashboard refresh briefly drains its cache under a lock, then releases it before writing the operational tabs. It never writes Records. This reduces request overhead but does not remove Apps Script quotas or guarantee a latency target. This backend is intended for a small community.
