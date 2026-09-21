# FitLens 2.5.0 — simpler activity, easier updates

## A clearer activity flow

Log an activity with its name, time and duration. Calories and notes are optional. The Auto / Included / Not captured controls are gone from the main form. Manual records say **Added by you**. Watch totals still prevent duplicate calorie counting; a collapsed calorie adjustment is available when watch calories exist or when editing a previously adjusted record.

**Your activity** now puts food, calories burned, movement and steps first. One primary action logs activity. Goals have their own screen. Watch settings have their own screen, with past-activity import and connection help collapsed until needed. Permission names are translated into everyday language. Disconnecting asks for confirmation. Existing data and counting policies are preserved.

## Required updates for the shared Android APK

This APK introduces the update checker. On launch, return to the app and every five minutes, Android checks the public release endpoint. Once a newer complete team release is published, a non-dismissible screen directs the user to its APK download. Android still asks the user to approve installation. Update in place; do not uninstall FitLens.

**Existing 2.4.0 and earlier installations need this one manual update.** They do not contain the checker and cannot be retroactively made to show it. This is not silent installation, a Play Store update, or an iOS updater.

The backend checks GitHub's latest published release, caches results for five minutes and only accepts a stable `vX.Y.Z-team.N` release containing both `FitLens-X.Y.Z-team-arm64.apk` and its `.sha256` asset. The client validates the repository download URL and compares numeric app versions. Drafts, prereleases, missing assets, same versions and older versions never trigger an update. Version and Android versionCode must increase on every release; publishing another team tag with the same app version does not force an update.

Publish only after CI and production checks pass and both signed assets are uploaded. Mark the release as latest. The required update becomes discoverable without another backend deploy (allow up to five minutes for caches). To withdraw a broken requirement, mark the prior good release as latest; affected devices need to reconnect for that change. Do not delete their app data.

If the app has never learned of an update and it is offline, it remains usable. A known required update is retained offline until installed or a valid server response withdraws it. No credentials are required for release discovery and no external APK hosts are accepted.

## Verification

36 automated tests cover existing behavior and complete-release validation, numeric version ordering, request caching and outage behavior. Browser checks cover manual activity, the simplified summary, separate goals, collapsed history imports, friendly connection details and existing diary/fitness flows. An isolated Android APK exercises the real update screen, offline cache across restart and the Android Back button. The production build uses the existing signing key and updates over 2.4.0.
