# Fitkin hosted preview

- Web app: https://fitlens-kpph.onrender.com
- API: https://fitlens-api.onrender.com
- Source branch: `main` (also pushed to `codex/fitlens-revamp`)
- Render workspace: Neha's workspace. API uses the **free** Node service in Singapore; web uses static hosting. Automatic deploys are disabled so releases can be checked before deployment.
- PostgreSQL: the user-provided Neon production database, using its pooled TLS connection. No Render database or ephemeral local database is used.
- Authentication: Firebase project `fitlens-b37f6`, Email/Password on Spark. No cloud AI service is used.

## Authentication

The existing HTTPS signup/login API delegates password authentication to Firebase; Neon stores profiles and Firebase UIDs, never Firebase passwords. Fitkin issues its own per-device sessions. Every authenticated request and refresh checks Firebase account status and token-valid-after time, so Firebase password resets and disabled/deleted accounts invalidate Fitkin sessions. Logout invalidates the current Fitkin session; deleting an account requires password confirmation and removes both the Firebase identity and Neon profile/data.

Password recovery sends a Firebase-hosted reset link. The user finishes resetting in the email link, then returns to the app to log in. Local development without Firebase configuration retains the isolated test password backend. Google sign-in is not exposed in this release.

## Secrets and configuration

Render environment variables: `NODE_ENV=production`, `NODE_VERSION=22.22.0`, `DATABASE_URL`, generated `JWT_SECRET`, `CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`. Private values are held in Render environment settings and ignored local `.data` files, not Git. Do not put service-account JSON into mobile code.

The API build installs only the backend workspace. Static web builds install only the mobile workspace with native install hooks disabled. The server applies its additive SQL schema at startup.

## Release checks

`npm test` covers account isolation, sync/idempotency, recovery, coach calculations and Firebase session revocation with test doubles. `node checks/firebase_live.mjs` explicitly tests a disposable account against real Firebase and Neon, including the hosted reset action, revocation, logout and deletion; it sends no email and cleans up its fixture.

For the hosted browser lifecycle:

```sh
FITKIN_WEB_URL=https://fitlens-kpph.onrender.com FITKIN_API_URL=https://fitlens-api.onrender.com python checks/e2e.py
```

Build an Android preview using `EXPO_PUBLIC_API_URL=https://fitlens-api.onrender.com` and `FITKIN_TEST_BUILD=false`; HTTPS is required. Use the current APK rather than the older LAN-only build.

Free plans have usage caps and can suspend service when allowances are exhausted. Render's free API sleeps after inactivity and can take time to wake. No paid plan or billing upgrade was enabled. The native LFM model downloads once after consent and then runs on device. Physical-phone health, LFM, notification and widget acceptance tests remain separate from cloud/browser checks.

## GitHub workflows and keeping free compute idle

The default `main` branch now contains four workflows:

- **Fitkin CI:** typechecks, backend/domain tests, web export, isolated browser account lifecycle and offline demo checks. It needs no production credentials.
- **Deploy tested main:** deploys the exact successful CI commit to both existing Render services, waits for them to become live and checks readiness. Render's own automatic deploy is disabled to avoid deploying before CI.
- **Build team APK:** manual signed ARM64 build. Keystore/password are GitHub Actions secrets. The artifact is available from the run for 14 days; releases provide the persistent team download.
- **API uptime check:** best-effort GET `/ping` every ten minutes. The endpoint is silent in application request logging and performs no database query. `/health` is also process-only; `/ready` checks Neon and is used at deployment, not on the frequent uptime schedule.

This avoids background checks continuously waking Neon. Render still counts awake API time toward the workspace's free instance-hour allowance. GitHub can delay schedules and disables schedules in inactive public repositories; this is not an always-on SLA. No paid runner, Render plan or billing upgrade is configured.

Keep `.data/fitlens-team.p12` and its password backed up privately. Never commit signing material. This key is distinct from the earlier development-signed APK; uninstall that older preview once before installing the team build. Subsequent team builds use the same key.
