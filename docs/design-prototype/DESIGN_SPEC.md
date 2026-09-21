# FitLens / Concept 01

## Product direction

Premium nutrition tracking with a warm, collectible sense of progress. The core job is to remember food with less friction and understand the day at a glance. Gamification rewards attention and consistency rather than restriction. Ember, a friendly orange flame, gives the product a recognizable emotional center.

## Navigation and hierarchy

Five bottom destinations: Today, Progress, Add food, Quests, You. Add food is the primary action and opens the logging flow. Nested screens use a back control. Food diary, nutrient breakdown, hydration, and the streak calendar are reachable from Today. Settings and account controls live under You.

Daily energy is the dominant dashboard metric; protein, carbs, and fat remain secondary. The streak and XP use separate surfaces so the energy budget is not confused with a score. Quests are optional.

## Visual tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | #101211 | Main background |
| Surface | #1B1E1B | Cards |
| Volt | #D1FA70 | Primary action, energy, XP |
| Ember | #FF9F68 | Companion, protein, warm moments |
| Water | #8ECFEA | Hydration and fat |
| Lilac | #C4B4F9 | Carbs |
| Primary text | #F4F5EF | Main text |
| Secondary text | #A2A99E | Supporting text |

Titles and numerals: Manrope 700–800. Body: DM Sans 400–700. Spacing: 4, 8, 12, 16, 24, 32. Controls: 12–14 radius. Cards: 17–24 radius. Sheets: 28 radius. Primary buttons: at least 49 px height. Font files currently load from Google Fonts; bundle licensed font assets in the Expo implementation.

The review shell uses a light neutral canvas so dark mobile screens remain easy to compare. It is review tooling, not an additional customer-facing dashboard.

## Flow inventory and existing implementation mapping

| Mockup | Existing implementation or proposed work |
| --- | --- |
| Today | `mobile/src/screens/DashboardScreen.tsx` |
| Food diary | Expand current dashboard meal sections into a dedicated view |
| Nutrition detail | `NutrientBreakdownSheet.tsx`, `MicronutrientsCard.tsx` |
| Hydration | `WaterTracker.tsx`, `useWater.ts`; expanded history concept |
| Progress | `mobile/app/(tabs)/history.tsx` |
| Add meal / food search | `LogFoodScreen.tsx` |
| Food & portion | `EditPortionSheet.tsx` |
| Custom food | Existing custom food modal in `LogFoodScreen.tsx` |
| Camera / analyzing / review | Existing photo capture and worker flow, with explicit review before confirmation |
| Meal logged | New success presentation around existing log result |
| Quests / levels / collection / rewards | New product and backend work |
| Streak | Existing streak data, expanded calendar presentation |
| Welcome | New entry experience |
| Login / registration | Existing auth screens |
| Password recovery | New recovery flow; requires backend/provider support |
| Profile / goal / targets onboarding | Existing onboarding screens split into focused steps |
| Ready | New plan confirmation |
| Profile / edit profile / edit goals | Existing profile and editing screens |
| Preferences / notifications | New settings persistence, reminder scheduling, notification work |
| Empty / loading / offline / scan error | Extend existing UI primitives and error states |

## Data and interaction contract

- Logging: search or photo -> review nutrition -> adjust portion -> choose meal slot -> explicitly confirm -> diary and dashboard update.
- AI: estimates must be labeled. Never silently save an unreviewed scan. Retake, edit and manual search remain available. The prototype uses a single illustrative food image.
- Portion controls increment by 0.25 servings with a minimum of 0.25. Production should retain the existing food-specific serving units and gram conversions.
- Profile fields and daily targets remain editable. The displayed sample targets are layout fixtures, not personalized calculations.
- Hydration increments by 250 ml in the main action. Production should support undo and arbitrary quantities alongside the current API.
- Offline: display a last-updated timestamp and clearly identify cached data. The prototype is illustrative; it does not implement synchronization.
- Account and notification operations are simulated. No real email, authentication, camera access, deletion, push notification, or external upload occurs.

## Gamification contract for implementation

- Meal logging: +25 XP once per meal slot per day; repeated writes and edits must be idempotent.
- Check-in: +10 XP once per day.
- Hydration check-in: +15 XP once per day, regardless of volume.
- Never award XP for calorie deficit, weight change, food avoidance, or excessive intake.
- Earned XP is not removed when a streak is missed.
- Streaks count daily engagement rather than hitting nutrition targets.
- Implement reward events server-side with a unique user/date/event key and transactions. The mockup uses in-memory flags only.
- Level and badge unlock tables need explicit production thresholds. The displayed level-4 sample is a concept fixture.
- Collections stay personal; there is no public weight-loss competition.

## Motion and accessibility

Press: 120 ms, scale 0.98. Sheet: approximately 280 ms ease-out. Meaningful progress change: 400 ms. Celebration: a single short moment. Respect reduced motion and haptic preferences. Label nutrient colors; use semantic actions and focus indicators. Before shipping, validate VoiceOver/TalkBack, font scaling, contrast, and 44+ px touch areas across devices. The review prototype's compact mobile typography and secondary controls are not an accessibility certification.

## Assets

- `dist/assets/ember.png`: original 3D flame companion.
- `dist/assets/meal-bowl.png`: illustrative meal photo, used for scan and food previews.
- `dist/assets/achievement.png`: original collectible medallion.

Generated with the built-in imagegen tool. Exact prompts are in `ASSET_PROMPTS.md`. Additional production food photography and achievement variants can follow the same direction after the concept is approved.

## Boundaries

This is a reviewable mockup and implementation reference, not a production frontend. No native app or backend source was rewritten. Native implementation should reuse existing Expo navigation, state management, authentication, API integration, animation, and accessible components. The first build phase should migrate shared tokens and components, then tracking/logging flows, then add gamification and preferences with real persistence.
