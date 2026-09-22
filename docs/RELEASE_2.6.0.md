# Fitkin 2.6.0 — meet Kin

FitLens is now **Fitkin**, with **Kin**, a cheerful lime-green fitness companion. The new icon appears on the launcher and splash; welcome, chat, reminders, widgets, share cards, permission explanations and project documentation use the new identity.

Install this APK over the existing app. The Android package, signing key, account storage, offline queues and notification identifiers stay the same. Do not uninstall to rename the app. Version 2.5.0 users receive the existing required-update prompt once this release is published; earlier versions need a manual download.

## Downloads and compatibility

Choose **Fitkin-2.6.0-team-arm64.apk**. The identically signed **FitLens-2.6.0-team-arm64.apk** is a compatibility alias for old installed updaters. Both contain the Fitkin app. Publish both APK names and both checksum files on future releases so old clients can upgrade. The build script and Android workflow generate these pairs.

Release discovery accepts the existing `neha-pd/caloriesTracker` repository or a future `neha-pd/fitkin` rename, while preserving the old URL for 2.5 clients. New clients prefer the Fitkin-named download. GitHub’s old-name redirects must remain intact; do not create a new repository at the old name. Only a repository administrator can perform the rename. Backend discovery supports the rename before it happens.

Hosted API/web and Firebase project identifiers remain unchanged. They are infrastructure identifiers, not the app’s display name. Historical release notes retain their original titles.

The new icon was created with the built-in imagegen tool; [prompt and asset details](branding/FITKIN_ICON.md).

## Project website

A new static GitHub Pages site introduces Fitkin in Neha’s voice, with real demo screenshots, the build story, contribution links, system light/dark themes and reduced-motion support. See [website setup](../website/README.md) for the one-time administrator setting.

## Validation

Type checks and 38 automated tests passed. Browser checks passed for the account lifecycle, chat/reminder drafts, energy data, workouts, calendars, PNG exports, date/time pickers, device navigation and offline demo. The signed ARM64 APK keeps the existing signing certificate and package identity. Website checks cover mobile/desktop, light/dark themes, assets, anchors and the disclosure control. Physical watch testing remains a separate device check.
