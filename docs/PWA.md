# Fitkin on iPhone

Open [Fitkin](https://fitkin-train.netlify.app) in Safari, tap **Share → Add to Home Screen**, leave **Open as Web App** enabled if shown, then tap **Add**. Open the new icon and sign in with your existing email and password. The install/help screen reports when offline assets are ready.

## What works

Food search, meal/water logs, manual workouts, weight, progress, PNG share cards, Train plans and online Kin chat use the same app screens and account. Food, water and fitness edits save on the device first, then sync to the same private Sheets backend used by Android. Offline edits retry with stable request IDs to prevent duplicate records and XP.

Train plans and detailed sets remain device-local. Export them from Train settings before switching devices. The browser may clear stored data under storage pressure or when website data is removed; allow pending changes to sync before clearing storage. Use the PWA on a personal device, since it stores your login and diary locally. Sign out before sharing the device.

## Platform differences

- A PWA cannot read Apple Health / Apple Watch or install Android widgets. Log activities manually on iPhone.
- This version has **no background web push** or background health polling. Meal, water and workout reminders export as `.ics` calendar files. Import the file into your calendar and check its alert settings. Calendar controls those alerts; changing a plan or signing out of Fitkin does not edit/remove imported events. Re-importing may create duplicates.
- First sign-in, cloud sync, password reset and Kin chat require internet. Sync resumes while the app is open; a closed iPhone PWA cannot be relied on to upload queued changes.
- Safari and the installed app may use separate storage/sign-ins. The app prompts when a new static version is ready so you can finish an edit before reloading.
- Native iPhone installation, Calendar import and OS sharing still need testing on a physical phone. Automated WebKit tests cover the browser implementation, not iOS system dialogs.

## Build and host

Use Node 22.22+, run `npm ci`, and configure `EXPO_PUBLIC_APPS_SCRIPT_URL` using `mobile/.env.example`. This is a public endpoint, not a secret: access to records still requires verified authentication and an app session. Never place server keys or private migration files in the static output.

```sh
npm run typecheck
npm test
npm run build:pwa
```

Deploy **mobile/dist** to a static HTTPS host. The root `netlify.toml` configures Netlify's build command and output. Set `EXPO_PUBLIC_APPS_SCRIPT_URL` in its build environment. No Netlify Functions, new database or proxy is needed. The generated `_redirects` handles app routes and `_headers` ensures service-worker updates are checked.

The service worker versions the app shell, food library, fonts and exercise instructions together. It never caches Google API, authentication or chat responses. Account-specific offline data is managed separately by the app.

Local preview:

```sh
python3 checks/serve_pwa.py --port 5174
# In an environment with Python Playwright + Chromium/WebKit installed:
python3 checks/pwa_e2e.py --base http://localhost:5174
```

The optional `--live` check requires `FITKIN_LIVE_TEST=1` and `EXPO_PUBLIC_APPS_SCRIPT_URL`. It creates one disposable account, checks login/offline sync/logout, then deletes it. It never uses an existing user's diary.
