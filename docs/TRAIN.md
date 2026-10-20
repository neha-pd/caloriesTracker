# Fitkin Train

Train is a new screen in Fitkin, available from Today or **Build my workout plan** on the welcome screen. Guests can start without an account. It does not require AI credits. Train is included in the next Android APK; the previously published APK predates this screen.

## What works

- Five-step setup: goal, experience/readiness, available equipment, movement preferences, weekly schedule, instruction language and encouragement style.
- Editable starting routines from a deliberately small template pool. The full searchable library has 1,324 exercises and text instructions in English, Hindi, Spanish, French, Italian, Turkish, Russian, Chinese, Korean and Polish.
- Exercise favourites, custom sets/reps/rest, session timer, set-by-set loads and reps, effort notes, resumable sessions, weekly progress and JSON export.
- Training volume is completed reps × external load. Duration and volume are not calorie measurements. An authenticated user can add a saved session to the fitness diary; this does not invent a burn value.
- Exercise text and instruction languages ship in the Android APK and work offline.
- Opt-in Android weekly reminders and calendar-file export as a fallback. Calendar import is manual and repeated imports can duplicate events.

## Data and limitations

Detailed plans and sets live in device storage, separated by account (including a guest profile). They are **not synced between devices**. Export before clearing app data. Switching from guest to an account opens that account's separate training history.

Automatic routines are general adult starting templates, not injury rehabilitation or clinical advice. Read supporting-equipment requirements in the instructions. Library additions are user selections, not automatically validated for suitability. Instructions and translations may retain source errors. Progression suggestions are conservative prompts based on reported effort; they do not silently change the plan.

Rest alerts require the workout screen to remain active. The session timer pauses when the app backgrounds and reopens paused after reload. Native weekly notifications do not suppress already-completed days; there is no browser push service. Delivery depends on device settings, battery restrictions and is not guaranteed to arrive at an exact minute.

## Exercise data

Source: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). The pinned commit, source SHA-256 and languages are recorded in `mobile/src/features/train/data/source.json`. The upstream MIT licence and its media exception are preserved in `LICENSE.txt` alongside the data. Only text/metadata is included: **no GIFs, images or media URLs are redistributed**.

To refresh deliberately from a reviewed checkout:

```sh
python3 scripts/import-exercises.py /path/to/exercises-dataset
npm run test:train
```

## Build and validate

Follow [the Android and Apps Script setup guide](DEPLOYMENT.md). Run `npm run typecheck`, `npm test`, and build the signed APK with the configured Apps Script URL. Training plans themselves remain device-local; adding a completed workout to the fitness diary syncs that diary entry.

`checks/train.test.ts` covers catalog integrity, plan constraints, readiness, statistics and calendar recurrence. Notification receipt and native watch interaction require physical-device testing.
