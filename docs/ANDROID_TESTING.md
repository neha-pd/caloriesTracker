# FitLens Android preview

This is an internal ARM64 test build. It uses the generated development signing key, not a production Play Store identity. Model weights are downloaded separately after consent.

## Try the populated account

1. Install the APK, open FitLens and choose **Explore 45-day demo**. No login or running backend is required.
2. Review Today, Progress and Diary. The fictional data contains 256 food entries and 318 water records across 43 days in a 45-day window.
3. Open **You → On-device AI**, choose the smaller 450M model and enable its download. Keep the app open until it is ready. No API key is used.
4. Open **Ask Ember** from Today. Review an incomplete day, then mark it complete and request another review. Change the diary date to test historical days. Reviews use the selected day, not all history at once.
5. After the model has loaded once, test a review without internet access. Timing and memory use depend on the phone.
6. Open **You → Home-screen widgets**. Choose a theme, decide whether nutrition should be visible, and add each widget using the launcher's confirmation. Verify food/water shortcuts, values after logging, privacy toggle and cleared data after logout.
7. Test **Share my day → Daily story / Coach report**. Both sample exports must show DEMO. Share using the installed Android app picker.

Demo data edits survive logout. Re-enter the demo to resume. Deleting the demo account under Privacy removes its local fixture; re-entering creates a new sample. Health integration is disabled for the demo to avoid sending fictional meals to a real health store.

## Real account and health tests

This preview's real-account API runs on the development Mac. A phone needs the same network and the API process running. Offline demo and downloaded local AI do not depend on that API. There is no hosted service yet. Health Connect must be tested with a real account, compatible device and explicit permissions; actual health records must not be replaced by sample activity.

## Rebuild

From the repo root, set `JAVA_HOME`, `ANDROID_HOME` and optionally `EXPO_PUBLIC_API_URL`, then run `scripts/build-preview-apk.sh`. The script regenerates Android via Expo prebuild, builds ARM64 release, and copies the APK into `artifacts/`. `FITLENS_TEST_BUILD=true` enables HTTP for LAN testing; omit this flag for production configuration and provide HTTPS plus production signing.
