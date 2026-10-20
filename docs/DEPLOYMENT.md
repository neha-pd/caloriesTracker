# Fitkin: Android + one Apps Script backend

The release source uses one Apps Script web app and one private spreadsheet for profiles, food, water, fitness records, custom foods, XP, sync and Kin chat. Firebase remains the existing sign-in/password-reset service, so passwords and Firebase UIDs stay in place. There is no new Render server, Neon database, Netlify function, browser app or keep-alive job.

**Follow the steps below to set up your own deployment or migrate an existing installation.** Do not delete the old database or uninstall the existing APK.

## Files for the browser

Run `npm run build:backend` to generate:

- `apps-script/dist/Code.gs` (also supplied as `Code.js`): identical copies of the entire runtime. Paste **one** into the editor’s `Code.gs`; do not add both.
- `apps-script/dist/appsscript.json`: the Apps Script manifest. It enables Sheets API v4 and the required scopes.
- `apps-script/Configure.example.gs`: a public template for Script properties. The local handoff folder has a prepared private `Configure.gs` instead.
- `ImportData.gs`: a private, editor-run import function generated in the local handoff folder. It embeds the same snapshot as the JSON import file. Remove it from the script after the final import.
- `fitkin-migration.json`: generated from the old database and existing Firebase identities. This contains private user records; never put it in Git, GitHub issues or a publicly shared Drive folder.

Local handoff packaging: `node scripts/prepare-google-handoff.mjs /absolute/path/to/export-directory`. This copies only the deployable files, import JSON and report to `../../Fitkin-Google-Setup` relative to the repository. It does not include the database backup or Firebase service-account key.

## 1. Let setup create the spreadsheet

1. Sign in as **nehadesai924117@gmail.com** and open **script.google.com → New project**. No spreadsheet needs to be created manually.
2. Replace the default `Code.gs` with the supplied `Code.js` or `Code.gs` (they are identical; paste only one).
3. Open Project settings, enable **Show appsscript.json manifest file in editor**, then replace its contents with the supplied manifest.
4. Add a script file named **Configure**, paste the prepared `Configure.gs`, save, select **configureFitkin**, and run it. Review Google's authorization prompt yourself. This stores the owner, Firebase public settings and optional chat key in Script properties.
5. Select **setupFitkin** and run it. It creates **Fitkin private records**, initializes the **Records** tab/columns, saves its ID, and prints the spreadsheet link in the **Execution log**. Open that link to inspect it. The script does not grant sharing access; keep General access Restricted.
6. Running setup again reuses the same spreadsheet and preserves records and migration status. If a saved spreadsheet is inaccessible, it stops instead of silently creating an empty replacement.
7. You may delete `Configure` from the editor after it runs; settings remain in Script properties. Keep both the Apps Script project and spreadsheet private.

An existing spreadsheet-bound project is supported too: setup uses its container on first run, unless a spreadsheet ID is already configured. Creating a spreadsheet from a standalone script does not attach the script to its UI; use the editor import below, not a spreadsheet menu.

The manifest enables the advanced Sheets service. With the default Apps Script Cloud project, Google enables the corresponding API automatically. If you attach your own standard Cloud project, enable the Google Sheets API there too. [Google's setup documentation](https://developers.google.com/apps-script/guides/services/advanced).

## 2. Rehearse and verify the import

1. In Apps Script, add a script file named **ImportData** and paste the supplied `ImportData.gs` from the local handoff folder. This file contains private user records; keep it private.
2. Select **importExistingFitkinData** and run it.
3. Wait for `verified: true`, counts and the digest in the **Execution log**. It verifies the whole snapshot before writing and checks all imported records afterward.
4. If interrupted, run it again with the **same file**. Repeated batches are safe. Tampered records or a different snapshot stop the import.
5. To replace a rehearsal with a newer final snapshot, paste the newly generated `ImportData.gs`, change its `replaceStaged` flag to `true`, then run **importExistingFitkinData**. Replacement is rejected after activation. An invalid new snapshot is rejected before clearing the staged data.
6. **Do not run activateFitkin for a rehearsal snapshot while the old app can still write to Render.** Run it only after the final cutover below. Remove `ImportData` from the editor after the final import.

For a spreadsheet-bound project, the existing **Fitkin → Import existing data** menu remains an alternative that accepts the JSON file. Standalone projects use the editor flow above.

The public app endpoint stays unavailable while migration is waiting, importing or verified. Import/admin functions require the exact Google owner and are not exposed through the public RPC dispatcher.

## 3. Deploy the endpoint

1. Apps Script → **Deploy → New deployment → Web app**.
2. Execute as **Me** (the configured owner).
3. Who has access: **Anyone**. Android cannot use an interactive Google editor session; every private API request is instead verified with a Firebase ID token and a revocable app session. The spreadsheet remains Restricted.
4. Deploy and copy the URL ending in **`/exec`**, not `/dev` or an editor URL.
5. Send that URL back so it can be embedded in the final APK. The read-only URL reports protocol/setup readiness and never exposes records.

For later code updates, edit the existing deployment and select a **new version**. Keep the same deployment URL. Saving editor source alone does not update the published web app.

## 4. Final data cutover — once, before sharing the new APK

1. Keep the existing local database backup. Stop old writes by **suspending the Render API service** and disabling its auto-deploy. Allow in-flight requests to finish. Users can retain offline edits on their phones; do not ask them to uninstall.
2. Export again from Neon after writes stop. The local agent can do this when you report that Render is suspended; or run `npm run export:legacy`. The exporter is read-only, takes a consistent database snapshot, validates Firebase identity mappings, and writes a fresh timestamped directory under `.data/` with owner-only permissions.
3. Compare the final export digest with the verified import. If they match, no re-import is needed. Otherwise, package the new export; reset the staged import and import this **final** file. Wait for verified counts/digest again. If export/import fails, keep the old data intact; resume the old API only while the new backend is not activated.
4. Run **activateFitkin** in the Apps Script editor after the final import is verified. Its read-only endpoint should now report `ready: true`.
5. Set `EXPO_PUBLIC_APPS_SCRIPT_URL` in the build environment and `FITKIN_APPS_SCRIPT_URL` in GitHub repository **Variables**. The build checks the real endpoint and refuses to produce a release against an unfinished migration.
6. Build with the existing signing key and Android package (`com.fitlens.app`). Version 2.7.0 uses versionCode 11. Keep both Fitkin and legacy FitLens APK aliases/checksums in the GitHub release so old update links remain compatible.
7. Install over the existing APK. Sign in once with the existing email/password; the migration preserves the old app UUID so queued edits and local history reconnect to the same account. Verify the checks below before sharing broadly.
8. Keep Render suspended and retire the old Render web/Netlify deployments and schedules after verification. Keep Neon as a private rollback backup until the team accepts the migration; do not delete it prematurely. Once new writes reach Sheets, resuming the old API would split the data and requires a deliberate reconciliation.

There is a short maintenance window during steps 1–7. An old APK whose update check still points at Render may need the new APK link shared manually during that window. Android requires the user's installation approval; this is not a silent OS update.

## 5. Release checks on a device

- Existing account login: profile, targets, foods, water, workouts, custom foods and XP match the migration report.
- Log/edit/delete a meal and water while offline, reconnect, relaunch: no duplicate entries or XP. Preserve any pre-upgrade pending changes.
- Second account: no access to the first account's logs, exports, chat context or sessions.
- New signup, password reset, logout/re-login and account deletion with a disposable test account.
- Kin chat with context off/on; free-quota failure; reminder drafts require review.
- Android notifications allowed/denied, local reminder delivery offline, watch sync and background nudges on a physical phone.
- Train routines/set logs, share PNGs, widgets and direct GitHub update checks.

The automated suite tests core behavior, the generated Apps Script bundle with Google-service mocks, and the mobile transport. For an activated deployment, run `FITKIN_LIVE_TEST=1 EXPO_PUBLIC_APPS_SCRIPT_URL=your_exec_url node scripts/verify-google-backend.mjs`; it creates disposable accounts, exercises the deployed API and removes those accounts afterward. The live check validates deployed API behavior; it does **not** verify Android permissions, background delivery or watch behavior on a physical device.

## What migrates and what stays on the phone

The importer preserves existing app UUIDs and Firebase UIDs, all database food/water/fitness/custom-food rows (including deletion markers), user settings/targets and XP events. Firebase-only signups retain their Firebase login and get an app profile. Missing/duplicate Firebase identity mappings stop the export instead of silently merging accounts by email.

Passwords stay in Firebase. Old server access/refresh sessions are not imported; users sign in once after upgrading. A complete PostgreSQL snapshot, including old session tables, stays in the private local backup and is not uploaded.

Watch histories, scheduled local reminders, training plans/detailed sets and unsynced edits were device-local already. They remain on those phones under the existing storage keys. They cannot be recovered from Neon if a phone was wiped. Export training data separately before changing phones.

## Operation and limits

- Requests are validated and account-scoped. Mutations, XP and retry receipts commit in one atomic Sheets batch under a script lock.
- An extra per-device session is hashed in the sheet; logout revokes it. Google verifies ID tokens; decoded JWT text is never trusted by itself.
- Kin uses only the free model allowlist and zero maximum provider prices. Free model availability is not guaranteed. Keys stay in Script properties, never in the APK.
- Notifications and watch checks run on Android; no Apps Script timer or paid push service is needed. Delivery can be delayed by Android battery/permission policies.
- This is designed for a small private community. Apps Script and Google Sheets have execution, concurrency, request and storage limits; there is no unlimited-service promise. Check [current Google quotas](https://developers.google.com/apps-script/guides/services/quotas) before increasing usage. The app keeps queued offline changes when sync is unavailable.
- Back up the private spreadsheet regularly. Do not manually edit `Records` cells; use the app or a reviewed migration.
