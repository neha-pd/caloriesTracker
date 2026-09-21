# FitLens 2.3.0 team build

Food and movement now share one daily view. The update adds manual workout logging, dated weigh-ins, Health Connect / Apple Health history imports, a month calendar and year overview, and day/month/year PNG stories. Manual workouts default to watch-aware accounting to avoid adding calories twice.

Ember rejects raw model tool syntax, retries a malformed response once using free models only, and presents multiple reminders as editable drafts. Group confirmation schedules them on the phone; retries reuse draft IDs. Food and health context remain opt-in for chat.

## Updating

Install the signed ARM64 APK over 2.2.0; the app ID and signing certificate are unchanged. Open **Activity & burn details → Review & enable health access** to allow total calories and workouts. Use **Import recent 30 days** or explicitly allow older history. The watch's companion app must supply those records to Health Connect. Without those records, burn remains unavailable rather than inferred from steps.

Use **+ → Log activity** for manual workouts and **Log weight** for dated weigh-ins. Auto uses watch totals when present; select Not captured only for a workout missed by the watch. Movement goals are optional and do not change the food target.

## Verification

- TypeScript and backend build.
- 30 automated tests covering auth/XP, fitness CRUD/isolation/retries/conflicts/deletion, energy accounting, period coverage and leap years, model-output validation and free-only retry.
- Browser account lifecycle, offline demo, diary/XP, selected-day burn, workout save/edit with offline queue, weight, calendar, month/year PNG, chat drafts and quota errors.
- Android instrumentation: retired-model cleanup; seven daytime, edited four, overnight twelve notifications; three-meal group and duplicate-free retry.
- Signed production APK package, version, certificate and bundled API endpoint checked before publishing.

## Boundaries

Actual watch synchronization still needs testing on a physical phone with its paired watch. Apple Health code and permission descriptions are updated, but this release artifact is Android, not an iOS build. Imported health history stays on the device; manual records sync to the account. History sync runs while the app is active. Missing/partial records are labelled. Weight discussion describes recorded trends, not a promised future goal date. Free-provider limits and OS notification delivery rules still apply.
