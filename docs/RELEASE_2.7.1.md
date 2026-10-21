# Fitkin 2.7.1

- Installable iPhone PWA with persistent sign-in, offline food/activity logging, Train plans, share cards and calendar reminder exports.
- Platform-aware guidance: manual activity on iPhone, Android Health Connect on the APK. No promise of Apple Health access or background web push.
- Queued changes sync in batches of up to 20, with retry protection, per-item conflict handling and a snapshot in the same response.
- Private Sheets admin dashboard, usage and API timing tabs, storage overview and five-minute refresh.
- Android package and signing identity stay unchanged; versionCode is 12. Install over the previous APK.

Update the existing Apps Script deployment first using [admin setup](ADMIN_DASHBOARD.md). No data re-import is needed. [PWA setup](PWA.md) explains static hosting and iPhone limitations.

## Validation

Typecheck and 67 automated tests pass. Chromium and WebKit checks cover offline food logging, Train plan creation, install readiness, calendar files and PNG export on both local and Netlify preview builds. A disposable live account verifies persistent login, offline water/workout edits, batched sync against the deployed Apps Script, duplicate prevention, cache isolation and logout; the test account is deleted afterward.

The signed ARM64 APK builds successfully and retains the existing signing certificate. Physical iPhone Home Screen installation/Calendar import and Android watch/background-delivery checks still require device testing.
