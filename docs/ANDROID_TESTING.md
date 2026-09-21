# FitLens 2.2 Android team build

ARM64, Android 9+, version 2.2.0 / versionCode 6. The dedicated persistent team signing key allows upgrades over team builds 2.1.x. This is an internal test release, not a Play Store release. No AI weights are included or downloaded; the upgrade removes retired model files from the app's private storage.

## Try the populated account

1. Choose **Explore 45-day demo**. Its 256 food entries and 318 water records are fictional and stay local.
2. Open the first-use guide. Search poha, dosa, rajma or your own food. Add a portion and check that XP increases immediately.
3. Test Diary editing, water, daily quests and history. Edits and retries must not generate duplicate XP.
4. Open **You → Home-screen widgets**, select privacy/theme preferences and pin widgets through the launcher.
5. Test **Share my day → Daily story / Coach report**. Sample exports must show DEMO. Choose WhatsApp/Instagram using the Android share sheet.

Demo changes survive logout. Health and online chat are disabled in the demo to avoid sending fictional data to real services.

## Real account

The APK connects to https://fitlens-api.onrender.com. Free Render may need time to wake. Food search, cached logs and already scheduled local notifications work without AI.

Connect Health Connect from Home using a real account. Your watch must sync through its companion health app. Test permission denial, actual step/activity imports and confirmed food/water exports on a compatible physical device. Apple Health needs a separately built iPhone app; this APK cannot connect directly to Apple Watch.

Open Chat with Ember, optionally share diary/targets, and ask for a water reminder. Review the draft; only confirmation schedules it. Test notification permission, denied permission recovery, intervals, pause/edit/delete and logout cancellation. Free AI quota is shared and may be exhausted; it never falls back to paid models.

## Rebuild

Set `JAVA_HOME`, `ANDROID_HOME`, `FITLENS_KEYSTORE_PATH` and `FITLENS_KEYSTORE_PASSWORD`, then run `scripts/build-preview-apk.sh`. `FITLENS_TEST_BUILD=false` is the default and uses HTTPS. The GitHub **Build team APK** workflow uses repository signing secrets. Signing keys and service credentials must never be committed.

## Automated validation

Backend tests cover auth, diary isolation, free-only chat routing and XP idempotency/caps. Browser tests cover account lifecycle, offline demo XP, chat context opt-in, quota errors and reminder draft review. `checks/native-upgrade-smoke.tsx` is an isolated instrumentation entry for model cleanup and native interval schedule counts; it must never be shipped as the app entry point. Physical delivery, OEM background restrictions, watch sync and launcher behavior still require team-device testing.
