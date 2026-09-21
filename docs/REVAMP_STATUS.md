# Current release: 2.2.0

Manual food logging replaces photo AI; all local model downloads and runtimes are removed. The offline library has 13,681 foods with Indian search aliases and 146 transparent recipe estimates. Home exposes device connection and a short guide. Food XP updates locally and reconciles with per-entry server awards (10 XP, first 20 daily), plus existing meal bonuses. One online chat modal supports free-only model fallback, optional account-scoped diary context and validated reminder drafts; confirmation is required to schedule.

See [free chat](FREE_CHAT.md), [food sources](FOOD_CATALOG.md), and [current Android testing](ANDROID_TESTING.md). Earlier implementation notes below describe superseded releases, including the removed local AI.

---

# Revamp status — 21 September 2026

Branch: `codex/fitlens-revamp`.

## Implemented

Expo 57 / React Native 0.86 native app, new routes and design system, real API, persistent local development database, offline food catalog, offline mutation queue, account sessions, diary CRUD, hydration, profile/goals, progress/quests, privacy/export/deletion, local reminders, native LFM photo flow and health adapters.

The original app has no existing users, per the owner. This is a clean development baseline; compatibility with the old API/data is not a release requirement. Original server code is archived in `backend/legacy/` and is not built or shipped.

## Verified

- Backend integration suite: account lifecycle, authentication, rotating refresh, password reset/revocation, logout, deletion, account isolation, goals, diary edits, tombstones, hydration, XP deduplication, simultaneous retries, stale update conflicts, validation, CORS, date/streak boundaries.
- TypeScript checks for mobile (including platform adapters) and backend build.
- Expo production web export.
- Browser E2E: signup, onboarding, food search/log/edit, water, offline water + resync, quest retry, history, profile edit, health/AI browser fallbacks, logout/login persistence, custom food, deletion, JSON export, account deletion. No browser runtime errors in the passing run.
- Native iOS simulator compilation with LFM ExecuTorch and HealthKit libraries; signed simulator launch, native signup and onboarding to dashboard.

## Device acceptance still needed

- LFM model download/resume, actual inference accuracy, latency and memory on target phones. Native integration is implemented; photo recognition is not claimed as hardware-validated.
- Apple Health permission choices, write/update/delete deduplication and activity read using a real iPhone + Apple Watch.
- Android native build and Health Connect device tests. Android toolchain/device testing has not been completed here.
- Notification timing/permission changes and export share sheet on real phones.
- Android permission rationale must be reviewed for store submission; a hosted public privacy policy is required for distribution.

## Configuration before release

- Configure `RESEND_API_KEY` + `EMAIL_FROM` for real password recovery email delivery. The API reset lifecycle is tested; the local preview intentionally reports email recovery as unconfigured. No fake production recovery tokens.
- Optional Google login API requires `GOOGLE_CLIENT_IDS`; email is the supported UI login in this build.
- Production PostgreSQL, HTTPS API URL, strong JWT secret, restricted CORS origins, and database backup policy.
- Apple/Google signing and store accounts for distribution. A simulator app is not an installable iPhone release.

## Intentional behavior

- Apple Watch sync is through Apple Health on iPhone; no separate watchOS app.
- Health sync runs in foreground/on return to the app, not guaranteed background sync. It starts with logs created after consent and does not export old history automatically.
- Activity read from health stays local. It never increases food targets automatically.
- LFM only proposes names. Confirmed catalog/custom values determine nutrition. No photo or model output is uploaded to the API.
- Disabling AI leaves downloaded files cached. Clearing app storage removes them.
- Signed-in web tokens use sessionStorage; native tokens use Keychain/Keystore through SecureStore.
- User logs are account-private on the API; device caches are not separately encrypted beyond platform storage protection.

## Local handoff

Browser preview: http://localhost:8084 (API on :3000). iPhone 17 Pro simulator is running the signed development build, with Metro on :8081. A disposable Native Preview account is logged in for testing. No cloud deployment was performed.

Dependency audit currently reports inherited/toolchain advisories (including Expo transitive dependencies); review and resolve compatible upgrades before a public release. Do not use `npm audit fix --force`, which currently suggests downgrading Expo.

## Daily story sharing

Today → Share my day opens a preview with Midnight / Soft Cream themes and a switch to hide calories and macros. Exports 1080 × 1920 PNG files entirely on device. Native uses the system share sheet; browsers support file sharing where available and PNG download otherwise. Both styles and the nutrition-hidden mode were exported and visually checked in browser E2E. Native share-sheet destinations depend on installed apps; Instagram/WhatsApp posting remains a user action.

## Daily coach and complete report

- Today → Ask Ember reviews the selected day. Deterministic totals remain separate from AI suggestions. LFM selects and orders valid habit suggestions; arbitrary generated medical advice is not shown. User marks whether the day’s logging is complete. Cached reviews are local, account-scoped and invalidated when the data changes.
- The existing photo model also handles coach text prompts; no extra API or model download. AI screens release the runtime when unfocused. Physical-device generation is still an acceptance test.
- Custom reminders: editable title/message/time, daily/weekdays/weekends, optional 22:00–08:00 quiet hours, pause/edit/remove, maximum eight. AI drafts require user confirmation. OS notifications run without background LLM inference; logout cancels schedules. Notification delivery and installed-app behavior require phone testing.
- Share my day → Coach report contains all logged foods, portions and nutrition, energy/macros versus chosen targets, water, available current-day health activity, current profile weight, target weight and the difference. Reports grow vertically to preserve every food. Missing activity is labelled unavailable; active energy is not total daily burn. Weight is the latest profile value, not historical weigh-in data. No weight-loss deadline or exercise prescription is invented.
- Target weight is editable under My profile, persisted by the API, and included in account export.
- Validation: six backend/domain tests pass; expanded browser E2E covers weight targets, coach facts, reminder quiet-hour validation and browser fallback, complete report content and PNG export. Exported report visually inspected. iOS production JavaScript bundle exports successfully. Native LFM inference and actual notification delivery are not claimed as tested in this pass.

## Offline demo and Android widgets

- Welcome → Explore 45-day demo opens Neha Demo without a password or API. The fictional fixture contains 256 food entries, 318 water logs, 43 logged dates across a 45-day span, badges and a 17-day streak. Today is intentionally incomplete for testing coach behavior. Changes persist locally across logout and re-entry. No fake health activity is imported; health connections are disabled in demo mode. Share images label the sample data DEMO.
- Profile → Home-screen widgets offers Daily spark, Hydration pause and Ember check-in. Android RemoteViews widgets support Midnight / Soft cream and hiding nutrition totals. They show the last snapshot saved by the app, open logging/coach screens, and clear after logout. A new date displays a refresh prompt until the app opens. iOS widgets are not implemented.
- `checks/demo_e2e.py` validates fixture counts, dashboard/coach, widget preferences, local profile edits and logout/re-entry with all API traffic blocked; no API requests and no JavaScript errors. Browser assets require the local web server; native assets are embedded in the APK.
- Local AI model weights require a one-time download with internet access; inference then runs on device. The demo is useful for testing selected-day reviews; it is not a claim of longitudinal memory across all 45 days.

- Android release build completed successfully (ARM64, Android 9+, version 2.0.0). APK signature verified and installation on the Android emulator succeeded. This does not validate physical-device LFM inference, health permissions, notifications or launcher widget interactions. Test APK uses development signing and the LAN API URL.

## Hosted preview — 21 September 2026

Web: https://fitlens-kpph.onrender.com · API: https://fitlens-api.onrender.com. The API runs on Render Free in Singapore, with the provided Neon production database and Firebase Email/Password authentication. No paid plan was enabled. This supersedes the earlier local-only handoff notes.

Seven backend/domain tests pass. Real Firebase + Neon acceptance verified signup, refresh, a generated password-reset action, access/refresh revocation, login, logout and account deletion. The full browser lifecycle also passes against the hosted web app and API, including actual food/water persistence, offline sync, report PNG export and deletion. Test accounts were removed. Password-reset inbox delivery remains a user check; the automated test did not send mail.

The current ARM64 APK is version 2.0.0, Android versionCode 2, embeds the hosted HTTPS API, disables cleartext traffic, and includes all three widget receivers. Signature verification and emulator upgrade installation passed. It is a preview signed with the development identity. Physical-phone LFM, health sync, notifications and launcher widget interactions remain acceptance tests.
