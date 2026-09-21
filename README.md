# FitLens

A native Expo app for food, water, and everyday habit tracking. The revamp uses a dark/lime design, Ember companion, daily quests, XP, streaks, and achievements.

## Run locally

Requires Node 22+ and npm. From the repository root:

```sh
npm install
npm run dev:api:local
```

In a second terminal:

```sh
npm run mobile
```

For a browser preview, run `npm run web --workspace mobile`. The browser supports accounts and the full tracker; chat works when the backend has a free-provider key; health integrations require a native build.

The local API uses persistent embedded PostgreSQL in `backend/.data/local`. No Docker, Redis, AI API keys, or cloud accounts are required. `dev:api:local` deliberately ignores the original `.env`; use `npm run backend` when configuring your own database.

## Native builds

```sh
cd mobile
npx expo prebuild
npx expo run:ios
# or, with Android SDK and a device/emulator:
npx expo run:android
```

Expo Go cannot run the custom health and widget modules. On a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's reachable LAN URL (or your later HTTPS API deployment). The development build needs Metro running. Production builds require a public HTTPS API URL.

## Included

- Email registration/login, rotating sessions, logout, password reset API, export and account deletion.
- Onboarding, editable profile and daily targets.
- Offline USDA food search, custom foods, portions, meal editing/removal, daily diary and water.
- Persistent per-account offline queue, retry-safe writes, conflict handling, account sync.
- History, daily quests, XP, streaks, levels and badges. Rewards are for participation.
- A single online Ember chat with free-only model fallback, optional personal diary context, and reviewable reminder drafts. No model downloads or food-photo recognition.
- Apple Health/HealthKit and Android Health Connect adapters. Read steps/active energy; write confirmed nutrition/water after opt-in. Apple Watch data comes through HealthKit, not a standalone watch app.
- Local reminders, haptics, privacy and export controls.

## Verification

```sh
npm test
npm run typecheck
npm run export:web --workspace mobile
```

Browser E2E: install `checks/requirements.txt`, serve `mobile/dist` as a SPA on port 8084 with the local API on port 3000, then `python checks/e2e.py`. It creates disposable test accounts, verifies the full journey, and deletes the account at the end. Screenshots go to ignored `test-results/`.

See [development status](docs/REVAMP_STATUS.md) for what is verified and what still needs device testing, and [deployment notes](docs/DEPLOYMENT.md) for the later Render setup.

Food data: 13,681 foods from USDA FNDDS, SR Legacy, Foundation Foods, and 146 clearly labelled Indian recipe estimates. See [sources and rebuild instructions](docs/FOOD_CATALOG.md). The approved visual prototype is archived in `docs/design-prototype/`.

### Android preview and offline demo

Choose **Explore 45-day demo** on the welcome screen to try a fictional account with 256 food entries and 318 water records, without a backend. Android home-screen widgets are under **You → Home-screen widgets**. See [Android testing and APK build instructions](docs/ANDROID_TESTING.md) for reminder testing, widget checks and the reproducible ARM64 APK build.

Optional chat setup and free-only limits: [Ember configuration](docs/FREE_CHAT.md).
