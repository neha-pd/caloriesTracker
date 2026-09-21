# FitLens 2.4.0 — your rhythm, with Ember

## Easier dates and times

The diary date, calendar jump, activity date/start time, reminder editor and group reminder review now use calendar and clock controls. Android opens system pickers; iPhone uses a picker sheet; web uses browser date/time inputs. Future diary dates remain blocked.

## Personal step progress

Choose a daily step goal in **Activity & burn details**. Home shows recorded steps, progress, remaining steps and a goal-complete celebration. A missing reading remains unknown. Goals are user-selected (500–60,000 steps), optional, and never increase the food allowance. Ember receives the goal only when diary sharing is enabled.

## Dynamic notifications on Android

Open **Preferences & reminders → Gentle reminders → Personalize Ember nudges**. Enable smart nudges, choose breakfast/lunch/dinner times, quiet hours, and optional workout, step, water and movement notifications. Save the choices. Smart nudges replace the old fixed quick presets; separately created custom reminders remain independent.

An Android WorkManager job evaluates current local records at delivery time. It has no network constraint and does not call the backend or AI. Meal reminders skip meal categories already logged on this phone. Water nudges use the saved amount and stop at the chosen water goal. Optional movement prompts use varied deterministic daytime slots and stop after recorded exercise or the step goal. Copy rotates daily and can include actual step counts, remaining steps, logged water, workout duration and the user's first name. It never invents calories from steps.

Halfway and goal-complete step celebrations each have stable daily identifiers. Completed watch workouts use a persisted time fingerprint to prevent repeat checks or mirrored records sending duplicate alerts. Matching manual workouts suppress the prompt. Sessions predating initial enable are not replayed; lookback is bounded to the past 24 hours. Tapping a workout notification opens its date in Health & watch sync for review; it does not create a duplicate manual workout.

Smart delivery is limited to eight notices daily, with at least 30 minutes between notices, at most two workout prompts, and configurable quiet hours. The worker checks roughly every 15 minutes when Android permits. Late meal prompts expire after 90 minutes rather than arriving hours later. There is no permanent foreground service or battery-exemption request. Notification content uses Android private visibility and the user's OS lock-screen settings.

## Watch access and offline behavior

Connect Health Connect first. In smart-nudge settings, tap **Allow background watch checks** and approve background reads plus exercise/steps. The app checks feature availability and permission separately. Unsupported or denied background access does not disable local meal reminders; watch data refreshes when the app is opened. The watch's companion app must write its records to Health Connect. Some companion apps themselves require internet.

The background job survives ordinary app dismissal and is managed across reboot by WorkManager. Android can delay it for battery/Doze restrictions; force-stopping the app prevents checks until reopened. No claim of instant or continuous watch monitoring is made. Actual watch/companion interoperability requires a physical-device test. Smart background nudges are Android-only in this release; iPhone custom scheduled reminders still work.

## Data and verification

Only the active user's minimal recent local diary/health context is copied into private app preferences for background decisions. No API tokens or cloud keys are stored there. Logout stops work, removes posted smart notifications and clears the background context. Account deletion also removes this device's smart preferences; exports include them. Account changes reject a worker's stale result. Native configuration and logout operations are serialized from JavaScript.

Verified: 33 backend/pure-domain tests; account/offline diary/browser regression suites; native date/time control compilation; step goal and picker browser tests; Android instrumentation in airplane mode using explicit workout fixtures. Native tests cover actual worker delivery and retry, step milestones, missing steps, same-day deduplication, quiet hours, logged meals, water goals, cooldown, daily cap, manual-workout overlap, history suppression, disable and logout cleanup. Synthetic fixtures validate behavior, not a physical watch connection.

Implementation references: [Health Connect background reads](https://developer.android.com/health-and-fitness/health-connect/read-data), [WorkManager periodic work and constraints](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work).
