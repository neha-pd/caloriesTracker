# FitLens: food, movement and progress redesign

Status: 2.3.0 implementation and release verification. The design below records the broader direction; the shipped scope and limits are explicit here.

## Implemented in 2.3.0

- Three daily rings, optional movement goals, distinct active/total burn and missing-data states.
- Android steps/active/total/workout permissions, explicit older-history permission, 30-day or 365-day import. iOS active/resting/workout reads. Daily snapshots remain account-isolated on the device and are included in export/deletion.
- Manual workout create/edit/delete, offline queue, dated weigh-ins and authenticated server persistence. Auto/included/additional accounting avoids adding manual estimates to watch totals by default.
- Month calendar, year overview with month drill-down, recorded-day totals and dated weight change. No-data days are not zeros.
- Day/month/year story PNGs, motion rings/calendar mosaic and dark/cream palettes, nutrition visibility, classic daily story and full daily coach report including workouts.
- Ember tool-syntax guard, one bounded free-only semantic retry, multiple reminder drafts, explicit yes-to-draft state, editable group review, rollback on scheduling failure and stable IDs for retry. No action is scheduled from the model response alone.
- Opt-in device daily summary, server-owned manual records, last-30-day food summary and observed weight trend after three readings spanning at least two weeks.

## Release limits and data semantics

- Actual watch interoperability requires testing with the user's watch/companion app. Permissions do not manufacture calorie records. No background history permission or continuous background import is requested; sync runs while the app is active.
- iOS energy uses the largest active-energy source and basal energy from that same source, rather than adding overlapping apps. Android uses platform aggregates. iOS workout minutes are elapsed session time with overlapping intervals merged; Android uses aggregate exercise duration. Manual overlapping durations are merged. Session counts describe records, which may include a manual annotation of an imported workout.
- Imported history is stored locally, not uploaded as raw health data. Only an explicitly shared selected-day summary goes to Ember. Manual fitness records and weigh-ins sync to the account.
- Food completeness is unknown; period totals show their recorded-day denominator. There is no validated future weight/date prediction, historical goal snapshots, exercise prescription, distance/sets tracking, square PNG, or multi-page period coach report. The current food target is labelled as a chosen target, not historical target adherence.
- Story cards omit names/weights; nutrition can be hidden. The detailed daily report is a deliberate full-data preview and labels profile weight as undated.
- Eight custom reminders / 60 OS notification triggers remain the caps. Free AI capacity can still be exhausted. Notification delivery timing depends on the operating system.

The remaining sections describe the design direction and rationale; options beyond this release are not claims of completed functionality.

## What the current app actually supports

- Health adapters read today's steps and active energy only. They do not import workout sessions, resting/total expenditure or historical daily summaries.
- The health store persists connection metadata, not a historical activity ledger. Food/water writes currently run before activity reads, so a failed write can block refreshing activity.
- The connected label means authorization completed, not that every requested metric is available. In the screenshot, 706 steps and 0 active kcal do not prove that workout calorie data has synced.
- The backend coach explicitly receives `activity: Not available to this chat`. It cannot currently explain a real activity trend.
- Chat accepts one reminder draft. The reported response is native model tool syntax slipping through its plain-text fallback. Three daily meals require three named times, not one repeating water-style interval.
- Sharing is daily story or daily coach report; progress is a rolling list/chart rather than a month calendar.

## Today: the first screen

Order the screen around the user's day, with the essential information visible before setup cards:

1. Compact greeting, tappable date/calendar and device status chip.
2. Three labelled rings: **Food** (consumed vs chosen intake target), **Move** (active kcal vs optional movement goal), **Exercise** (minutes vs chosen daily goal). Each ring opens its details. Food is a target, not a challenge to maximise calories; missing activity appears as unavailable, not an empty achievement.
3. Energy summary: food eaten, active burn, resting burn and total burn where available. Show source, freshness and whether the numbers cover only part of the day. No automatic increase of food allowance from workout calories.
4. Clear **Add food**, **Add activity**, **Add water** actions. The main plus button opens these choices plus weight check-in.
5. Meals/workouts timeline, quick Ember review and Share. Move the full connection/setup cards into expandable details; the first-use guide becomes a compact dismissible prompt.

Keep Today / Progress / Add / Quests / You navigation. Progress gains Calendar / Trends rather than adding more bottom tabs.

## Burn and watch data: correct accounting first

Use Android Health Connect and Apple Health. A compatible watch's companion app must write the relevant data; a steps permission alone cannot supply missing calories. Add supported workout/session and total/resting-energy read permissions with an explanation when the user enables them.

Store the selected day's values independently of today's live values. Fetch by timezone-aware day boundaries, including DST and travel handling. Save source IDs, provider/package, metric coverage, sync time and deletion/update metadata. Start with a bounded recent backfill; older history is imported only when platform permissions and actual source history allow it. Never fabricate a year's history from a newly connected watch.

Health Connect aggregates help handle overlapping source records. Keep a documented equivalent source-priority policy on iOS. Separate read sync from optional nutrition/hydration export; a rejected write must not hide successfully read activity. Display partial permissions and missing/stale metrics individually.

Energy policy:

- Active burn is movement/exercise energy. Resting energy is separate. Workout calories are generally a component of active energy, so do not add imported workout calories onto an already aggregated active total.
- Prefer a compatible provider's total-energy aggregate where supplied; otherwise combine compatible active/resting summaries with matching time coverage and provenance. Do not combine incompatible overlapping sources.
- Food minus active burn is **not** a daily energy deficit. Only show an estimated energy balance against total expenditure with adequate coverage. Label today's readings as so far.
- Manual workouts overlapping watch data are annotations by default, not extra burn. Let users resolve likely duplicates and mark activities not captured by the device. If overlap cannot be established, do not silently add both totals.
- Without a device, accept user-entered calorie estimates or a documented activity estimate when sufficient inputs exist. Label these estimates; duration-only logging is always allowed. Never infer zero from unknown.

References: https://developer.android.com/health-and-fitness/health-connect/aggregate-data ; https://developer.android.com/health-and-fitness/health-connect/experiences/workouts ; https://developer.android.com/health-and-fitness/health-connect/read-data ; https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/activeenergyburned

## Add activity

Quick options: walk, run, cycle, strength training, yoga, swim, sport and custom. Fields: date, start time, duration, optional distance, optional calorie estimate, notes. Strength training can include an optional exercise/sets/reps/weight log without pretending those values establish accurate calorie burn.

Imported sessions are labelled with their source and use stable external IDs for update/delete and repeat-sync safety. Users can edit their own manual entries; imported values are corrected at source or explicitly excluded. Offline writes queue and reconcile like food entries. Reward logging/consistency, not burning ever more calories.

## Calendar and trends

- Day: complete food, water, workouts and energy summary.
- Month: swipeable calendar, miniature completion markers for food/activity and a clear selected-day panel. Explicitly distinguish no data, partial log, rest day and a completed log.
- Year: activity/logging heatmap and month drill-down. Accessible text summaries accompany colours.
- Trends: 7/30/90-day views and month/year selectors; intake, active burn, exercise minutes, steps and weight check-ins. Different metrics keep their units; missing readings are gaps rather than zeros.
- Store dated weigh-ins and effective-dated targets. A current profile weight must not be rendered as if it were the user's weight six months ago.

## Ember: reliable actions and grounded progress

Immediate guard: reject native tool delimiters/function text instead of displaying or evaluating it. A malformed answer must produce a recoverable message, never raw code or a claim that something was scheduled.

Next implementation:

1. Separate a user-facing reply from typed, validated action drafts. Support a bounded list of named reminder drafts. Model/provider validation failures can trigger a bounded free-only fallback, with account quotas and zero-price restrictions preserved.
2. For three meals, collect preferred times or offer clearly labelled examples (e.g. 08:00, 13:00, 19:30). A subsequent yes resolves the pending proposal through explicit app conversation state, not reliance on a model guessing the prior turn. Show three editable reminders and confirm as a group. Scheduling must roll back on partial failure and not duplicate on retry. The current eight-reminder and OS pending-notification limits remain visible.
3. Clear distinction between draft, confirmed and actually scheduled status. The model never directly mutates data or OS permissions. Persist per-user pending drafts only if needed and clear them on account change.
4. With visible consent, provide account-scoped daily/recent summaries of meals, activity, weight and goals, plus data coverage and sources. Provide numbers calculated in application code, not totals invented by the model. Avoid forwarding raw health records unnecessarily; include these records in export/delete policy.
5. Support questions such as “How was this week?” and “If I maintain this routine, how am I progressing?” Start with descriptive consistency and observed weight/fitness trends. Add labelled what-if projections only when repeated weigh-ins, adequate completed logs and an appropriate validated method are available. Present assumptions/ranges, not a guaranteed target date. One day's food minus workout calories cannot support a weight forecast. Strength, endurance and weight goals need different progress measures.

Projection design reference: NIH/NIDDK's dynamic approach, rather than a fixed calories-to-weight promise: https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner . Implementation of a quantitative weight projection is gated on method validation; it is not part of the language model's arithmetic.

## Share studio

Choose **Day / Month / Year**, then **Story / Coach report**, then style:

- Midnight rings: current lime/black visual identity.
- Soft cream: quiet editorial layout.
- Activity poster: bold workout and movement statistics.
- Calendar mosaic: month grid with logged/active-day markers.
- Year in motion: twelve-month heatmap, activity totals and milestones.

Story PNG at 1080×1920; optional 1080×1080 square. A detailed coach report may need multiple pages/images rather than tiny text. Day report includes all foods and workouts; month/year reports contain accurate summaries, source coverage, goals and actual recorded weight change. Do not multiply partial-year totals into invented full-year results. Average intake uses explicitly completed food-log days, with denominator shown; activity averages show covered days. Never treat days without records as fasting/rest days.

Privacy controls: hide weight, calories, names and workout detail. Preview the exact image, label estimates/missing coverage, then export through the phone share sheet. Styles must change composition as well as colour. Test long Indian food names, large text, partial periods and leap years. Existing daily shares stay available during the rollout.

## Data and implementation work

Add account-scoped workout records, daily activity summaries, dated weight records, effective-dated targets and log-completeness metadata. Imported IDs must be unique per user/provider; do not merge accounts sharing a phone or watch. Preserve existing diaries and XP events. Health data sent to the backend requires explicit opt-in, minimal data fields, authenticated access and export/deletion support; local-only tracking remains available.

Separate pure calculations for energy selection, duplicate handling, day/month/year summaries and source coverage from UI and AI. Reuse these calculations in rings, calendar, coach context and PNG output, so all views agree.

Implementation sequence:

1. Ember output guard and regression test (small backend fix).
2. Activity ledger, manual workout flow, historical health adapters and deduplication tests.
3. Redesigned Today rings, activity detail and compact connection state.
4. Calendar, weigh-ins, period summaries and goal history.
5. Ember multiple-reminder review and activity-aware trend conversations.
6. New share compositions, physical-device validation, signed APK and deployment.

Release checks: no duplicated burn after repeat sync; no mixing users or days; missing permission vs missing data vs zero; manual/watch overlap; timezone/DST/leap-year boundaries; offline add/edit/delete; historical goal changes; monthly denominators; raw tool output across every free fallback; three-meal confirmation/retry/partial-failure rollback; quota exhaustion; notification permission denial; PNG numerical parity and privacy toggles. Watch compatibility and actual delivery must be checked on physical devices.
