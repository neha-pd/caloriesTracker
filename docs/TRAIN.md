# Fitkin Train

Train is a new screen in Fitkin, available from Today or **Build my workout plan** on the welcome screen. Guests can start without an account. It does not require AI credits.

## What works

- Five-step setup: goal, experience/readiness, available equipment, movement preferences, weekly schedule, instruction language and encouragement style.
- Editable starting routines from a deliberately small template pool. The full searchable library has 1,324 exercises and text instructions in English, Hindi, Spanish, French, Italian, Turkish, Russian, Chinese, Korean and Polish.
- Exercise favourites, custom sets/reps/rest, session timer, set-by-set loads and reps, effort notes, resumable sessions, weekly progress and JSON export.
- Training volume is completed reps × external load. Duration and volume are not calorie measurements. An authenticated user can add a saved session to the fitness diary; this does not invent a burn value.
- Installable PWA: after the initial online load and offline cache finish, Train and all instruction languages work offline. API requests and personal server responses are never service-worker cached.
- Opt-in browser push on Netlify, weekly native reminders, and calendar-file export as a fallback. Calendar import is manual and repeated imports can duplicate events.

## Data and limitations

Detailed plans and sets live in device storage, separated by account (including a guest profile). They are **not synced between devices**. Export before clearing browser data. Switching from guest to an account opens that account's separate training history.

Automatic routines are general adult starting templates, not injury rehabilitation or clinical advice. Read supporting-equipment requirements in the instructions. Library additions are user selections, not automatically validated for suitability. Instructions and translations may retain source errors. Progression suggestions are conservative prompts based on reported effort; they do not silently change the plan.

Rest alerts require the workout screen to remain active. The session timer pauses when the app backgrounds and reopens paused after reload. Native weekly notifications do not suppress already-completed days; browser push can suppress a completed day after online sync. Delivery depends on device settings, network and hosting quota and is not guaranteed to arrive at an exact minute.

## Exercise data

Source: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). The pinned commit, source SHA-256 and languages are recorded in `mobile/src/features/train/data/source.json`. The upstream MIT licence and its media exception are preserved in `LICENSE.txt` alongside the data. Only text/metadata is included: **no GIFs, images or media URLs are redistributed**.

To refresh deliberately from a reviewed checkout:

```sh
python3 scripts/import-exercises.py /path/to/exercises-dataset
npm run test:train
```

## Build and deploy

```sh
npm ci
npm run typecheck
npm test
npm run test:train
EXPO_PUBLIC_API_URL=/ npm run build:pwa
```

`mobile/dist` contains the complete web export, manifest, icons, versioned service worker and language files. `netlify.toml` defines the SPA/API redirects and two server functions. Connect this repository in Netlify with **repository root as base directory**, build `npm run build:pwa`, publish `mobile/dist`, functions `netlify/functions`. Use the Free plan, with no paid add-ons or automatic top-ups. Quota exhaustion can pause the app/reminders; free hosting is not unlimited.

For an existing Netlify site, using a locally authenticated official CLI:

```sh
netlify deploy --filter mobile --site YOUR_SITE_ID --dir "$PWD/mobile/dist" --functions "$PWD/netlify/functions" --no-build
# Review the draft URL, then publish the same source/build:
netlify deploy --filter mobile --site YOUR_SITE_ID --dir "$PWD/mobile/dist" --functions "$PWD/netlify/functions" --no-build --prod
```

A static drag-and-drop deployment alone cannot run reminder functions. Deploy the functions too. Other static hosts can serve the PWA and calendar export, but browser-closed reminders require an equivalent push service. The API redirect currently points to Fitkin's existing Render API; change it in both `netlify.toml` and `scripts/prepare-pwa.mjs` for your own backend. No API secrets belong in `EXPO_PUBLIC_*` variables.

## Browser push service

`train-push` handles consented subscription management using an unguessable per-device capability token. Only the hashed token is stored. Requests are same-origin, input validated and rate limited. Approved push-provider endpoints prevent arbitrary outbound URLs.

Netlify Blobs holds the VAPID keys and subscription records: push endpoint/keys, selected days/time, timezone, tone, last completed date and last notification date. It does not receive sets, body weight, workout notes or account IDs. The private VAPID key never reaches the browser. Server-created keys remain stable across deployments.

`train-reminders` runs every 15 minutes in production. It checks local timezone/DST, quiet hours (22:00–08:00), bounded lateness, completion and an atomic daily delivery claim. Failed delivery is not repeatedly retried the same day; expired endpoints and records inactive for 90 days are pruned. This is a small-community scheduler; inspect execution duration and quota before scaling beyond it.

Turning reminders off deletes the server subscription. Signing out also stops workout reminders on this device; if offline, the browser push subscription is revoked and the inaccessible server record expires. On iPhone/iPad, install through Safari → Share → Add to Home Screen, open the installed app, then enable notifications. Permission is requested only after tapping Enable.

## Validation

`checks/train.test.ts`: catalog integrity, plan constraints, readiness, statistics and calendar recurrence.
`checks/train-push.test.mjs`: endpoint validation, schedule limits, timezone/DST, quiet hours, completion and duplicate suppression.
`checks/train_e2e.py`: readiness, editing, Hindi instructions, set logging, persisted reload, volume, calendar/JSON export, offline launch and separate browser storage. Screenshots are written to ignored `test-results/train`.

Physical-device notification receipt, iOS installation and native watch interaction require device testing; browser tests cannot prove OS delivery behaviour.
