# Fitkin 2.7.0 — Android and Google Sheets

This release moves Fitkin's app server logic to one Apps Script deployment backed by a private Google Sheet. Firebase remains the existing sign-in and password-reset service. Existing accounts retain their Firebase identity and app UUID; food, water, fitness, custom foods, settings and XP are migrated with a complete-record integrity check.

## For the team

- Install the update over the existing APK. Keep the same Android package and signing key; do not uninstall.
- Sign in once with your existing email and password. Old server sessions are retired, while local diaries and pending edits retain their storage keys.
- Food, workouts, water and custom foods still work with the offline queue. Request IDs keep retries from duplicating records or XP.
- Kin chat runs through Apps Script using only free provider routes. Availability remains subject to the provider's free quota.
- Android notifications, Health Connect, widgets, sharing and Train continue on the device. Detailed training plans and watch caches remain device-local.
- Update checks use GitHub directly; the new APK does not depend on the old Render server.
- Nutrition targets are previewed before saving; the demo uses the same calculation as real accounts.

## Hosting and maintenance

The old Fastify backend, Render deploy/uptime workflows, Netlify functions and PWA deployment configuration are removed. APK builds and CI remain, along with the static GitHub Pages project website. Apps Script setup creates its own spreadsheet and supports resumable, owner-only imports. Keep that spreadsheet and its script project private.

Validation: TypeScript checks, 61 automated tests and the signed ARM64 release build passed. Disposable-account checks against the deployed backend also passed: signup/sign-in, isolated diaries, retry-safe food edits and XP, fitness/water/custom foods, targets, export, free-only Kin chat, logout, token refresh and account deletion. The APK embeds the Google backend endpoint and keeps the existing Android signing certificate. Device-specific permissions, background notification delivery and watch interoperability still need team testing on physical phones. See [deployment and migration](DEPLOYMENT.md) for the checklist and rollback limits.
