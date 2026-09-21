# FitLens redesign studio

Archived design prototype used to guide the FitLens revamp. The implemented application now lives in `mobile/` and `backend/`.

## Review

Three modes: **Prototype**, **All screens**, and **Design system**. The sidebar contains all 35 screens; on small displays a screen selector replaces it. The arrows navigate the complete screen inventory. Reset demo restores the original sample day.

Run locally from this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. Refresh after source edits; this static preview does not hot reload. Individual screen links use fragments, e.g. `#review` or `#quests`.

## Scope

- **Everyday:** Today, food diary, nutrition detail, hydration, progress.
- **Food:** Add a meal, food search, food/portion details, custom food, photo capture, analyzing, AI estimate review, logging success.
- **Progression:** Daily quests, level journey, badge collection, reward celebration, streak calendar.
- **Onboarding:** Welcome, sign in, registration, password recovery, profile setup, goal selection, daily target review, plan ready.
- **Account:** Profile, edit profile, edit goals, preferences, notifications.
- **Edge states:** First-day empty, loading, offline, scan error.

## Connected interactions

Search the local food examples; change portions; add food to a meal slot; see energy and macro totals change; create a custom food; add water; edit targets and profile details; change preferences; claim a quest; inspect badges; filter the screen gallery. All state is in memory and resets on reload. No account, email, camera, AI service, or nutrition backend is connected.

## Verification

```sh
node --check dist/app.js
node checks/verify.mjs
```

The verification checks all 35 distinct renderers, screen destinations, local image references, gallery/system rendering, portion logging, energy totals, XP deduplication, hydration, search, target edits, and reset. This is source/runtime verification, not a device or assistive-technology acceptance test.

See `DESIGN_SPEC.md` for build guidance and `ASSET_PROMPTS.md` for the original asset prompts.
