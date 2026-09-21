# FitLens hosted preview

- Web app: https://fitlens-kpph.onrender.com
- API: https://fitlens-api.onrender.com
- Source branch: `codex/fitlens-revamp`
- Render workspace: Neha's workspace. API uses the **free** Node service in Singapore; web uses static hosting. Automatic deploys are disabled so releases can be checked before deployment.
- PostgreSQL: the user-provided Neon production database, using its pooled TLS connection. No Render database or ephemeral local database is used.
- Authentication: Firebase project `fitlens-b37f6`, Email/Password on Spark. No cloud AI service is used.

## Authentication

The existing HTTPS signup/login API delegates password authentication to Firebase; Neon stores profiles and Firebase UIDs, never Firebase passwords. FitLens issues its own per-device sessions. Every authenticated request and refresh checks Firebase account status and token-valid-after time, so Firebase password resets and disabled/deleted accounts invalidate FitLens sessions. Logout invalidates the current FitLens session; deleting an account requires password confirmation and removes both the Firebase identity and Neon profile/data.

Password recovery sends a Firebase-hosted reset link. The user finishes resetting in the email link, then returns to the app to log in. Local development without Firebase configuration retains the isolated test password backend. Google sign-in is not exposed in this release.

## Secrets and configuration

Render environment variables: `NODE_ENV=production`, `NODE_VERSION=22.22.0`, `DATABASE_URL`, generated `JWT_SECRET`, `CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`. Private values are held in Render environment settings and ignored local `.data` files, not Git. Do not put service-account JSON into mobile code.

The API build installs only the backend workspace. Static web builds install only the mobile workspace with native install hooks disabled. The server applies its additive SQL schema at startup.

## Release checks

`npm test` covers account isolation, sync/idempotency, recovery, coach calculations and Firebase session revocation with test doubles. `node checks/firebase_live.mjs` explicitly tests a disposable account against real Firebase and Neon, including the hosted reset action, revocation, logout and deletion; it sends no email and cleans up its fixture.

For the hosted browser lifecycle:

```sh
FITLENS_WEB_URL=https://fitlens-kpph.onrender.com FITLENS_API_URL=https://fitlens-api.onrender.com python checks/e2e.py
```

Build an Android preview using `EXPO_PUBLIC_API_URL=https://fitlens-api.onrender.com` and `FITLENS_TEST_BUILD=false`; HTTPS is required. Use the current APK rather than the older LAN-only build.

Free plans have usage caps and can suspend service when allowances are exhausted. Render's free API sleeps after inactivity and can take time to wake. No paid plan or billing upgrade was enabled. The native LFM model downloads once after consent and then runs on device. Physical-phone health, LFM, notification and widget acceptance tests remain separate from cloud/browser checks.
