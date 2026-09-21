# FitLens 2.1: local AI, voice and permissions

Open **Daily coach → Talk to Ember**. Download the conversation model once over Wi-Fi. Speak by tapping **Talk to Ember**; after you pause, the final transcription is sent to the local model. Replies are spoken when **Speak Ember’s replies** is enabled. You can type instead, stop generation/playback, read an answer aloud again, or clear the conversation.

## Food lens and conversation

- **Quick food lens (Android default):** Google AIY Food V1, bundled (~20 MB). No separate download. Recognizes one cropped dish from 2,023 labels; alternatives are mutually competing matches, not the full contents of a plate. No calorie or portion inference. Dosa is absent from the vocabulary. Apache 2.0 attribution and license are in `mobile/modules/fitlens-voice/AIY_MODEL_NOTICE.md`.
- **Optional LFM food photos:** LFM2.5-VL 450M (compact, about 650 MB) or 1.6B (enhanced, about 2.5 GB). Existing downloaded files are reused. Food names always need confirmation against the nutrition library.
- **Conversation, daily review and reminder drafts:** LFM2.5 1.2B (about 800 MB) by default, with a lighter 350M (about 280 MB) option. This requires its own explicit download consent. The larger model is preferable for conversation; the lighter model trades answer quality for memory and speed.

Only one inference session runs at a time. Each request gets a fresh native session which is disposed when finished. Recent conversation turns are explicitly bounded and passed back as context; repeated photos never accumulate in hidden history. A stop request or backgrounding cancels generation. The app cannot forcibly interrupt a native model constructor before it returns, so a subsequent request may briefly report that the previous request is still finishing.

The chat uses the selected day's logged meals, calculated totals, chosen targets, weight fields and available activity. It does not automatically edit the diary, change goals or schedule reminders. Chat is held in memory and cleared on logout/date change; recent turns are used for context. No cloud AI or API key is involved.

## Voice requirements

Dictation uses the OS recognizer with **on-device recognition required**. It never deliberately falls back to network recognition. Device/OS/language availability varies. Android 13+ can request the offline language download from the voice settings; unsupported devices retain typed chat. Microphone/speech permission is requested only after tapping Talk. Audio recording persistence is disabled.

Android replies use the FitLens native voice module, selecting an installed voice that does not require a network connection. If none is available, the answer remains visible with setup instructions. iOS uses the installed system speech voices and needs a separately built/tested iOS app. Voice language options are English (India) and English (US).

## Notifications and other permissions

Installation does not itself request every permission. After onboarding (or on first launch after this update), real accounts see a notification setup introduction. **Reminders** shows the current permission, an Enable button, a five-second test notification and a settings link. Allowing permission does not silently create recurring reminders: choose a schedule separately.

Camera/photo permissions are requested when choosing the corresponding food-photo action. Microphone/speech permission is requested for Talk. Health permission is requested for Connect Health. Download consent for AI is separate from all these permissions. Denial does not block manual food logging or typed chat when a model is available.

## Verification

Automated domain checks cover varied food-output formats, quoted numeric reminder times, role-label cleanup, bounded conversation history, stale/missing health data, and invalid reminder actions. Browser checks cover navigation into chat and its explicit native-only state. Android instrumentation uses a separate `com.fitlens.smoke` app to exercise real local model generation and notification scheduling; no production account is required.

Physical phone checks still matter: recognition quality across dishes, microphone capture and accents, audible playback, background notification delivery, and device-specific memory/latency. A model naming a dish is a suggestion, not a verified ingredient list or calorie estimate.

Reminder schedule parsing uses an explicit time in the user request. AI drafts wording only. Exact-time reminders require an explicit clock time. Since 2.1.1, hourly intervals are also supported. Vague “regular intervals” produces an explicitly proposed two-hour draft; all times are shown before confirmation. One-off schedules, custom interval windows and timezone conversions still require manual review.

## Measured results, 2026-09-21

A dosa/sambar/chutney fixture exposed the limits of both VLM sizes: compact often returned flatbread/dal, while enhanced named dosa with a cuisine hint but also invented sides. Google AIY returned Sambar as its strongest whole-photo match (~0.72 raw score); a crop of dosa instead favoured Quesadilla (~0.23). Scores are not calibrated correctness probabilities. Keep manual confirmation. The generic Kaggle card describes 224px float input, but the downloaded LiteRT artifact actually uses 192px uint8 tensors; the native implementation follows the artifact.

The 1.6B VLM caused a low-memory process kill on a 4 GB Android emulator. Enhanced vision is therefore restricted to 8 GB-class devices with an additional available-memory check. Chat uses its own text-only weights. Android native instrumentation produced conversational replies, selected daily-review tips, parsed a weekday 15:00 water reminder, accepted offline speech playback, and scheduled/cancelled a notification. Physical microphone capture and audible quality still need team testing.

Final Android classifier smoke test returned Sambar first (raw score 0.758) and Idli second (0.137), in 42 ms on the emulator. A populated 15-entry diary plus two prior exchanges generated a coherent response and recalled the earlier ingredients, though it did not answer every part of the calorie question. These checks validate the integration, not general model accuracy.

The optional native harness `checks/native-ai-smoke.tsx` requires a locally supplied `.data/ai-smoke-photo.json` object with a base64 JPEG under `base64`; the fixture is not shipped. Run only in a separate instrumentation application ID, never as the production entry point.

## 2.1.1: first-user interval reminder fix

“Drink water at regular intervals in 24hrs” now prepares a water reminder without AI: proposed every two hours, daily, 08:00–20:00 with quiet hours enabled. Change the interval or disable quiet hours for an overnight schedule (00:00–22:00 every two hours). This repeats on the chosen days; it is not a one-day timer. The preview lists every delivery time. Optional local AI polishes wording separately, so model setup or inference failure cannot block schedule drafting.

Changed or failed requests disable confirmation until prepared again or explicitly switched to manual editing. Existing single-time reminders remain compatible. Interval schedules expand to daily/weekly OS triggers, with a conservative 60-pending-notification cap. Editing replaces old trigger IDs; pause/delete cancels all occurrences. Android instrumentation verified seven daytime triggers, editing to four, pausing, resuming with twelve around-the-clock triggers, and deleting without leftovers. Browser regression covers the screenshot's exact request with a newly created account and no AI model.
