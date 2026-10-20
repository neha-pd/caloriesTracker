# Kin online chat

Set `OPENROUTER_API_KEY` only in Apps Script → Project settings → Script properties. No provider credential is bundled in the APK. Authentication is required for status and chat endpoints. The client cannot choose a model, endpoint, system role or another user's ID.

The server allowlist is Gemma 4 26B A4B free, LFM 2.5 2.6B free, and Qwen3.8 27B free. OpenRouter tries that list as fallbacks. Every ID explicitly ends in `:free`; provider maximum prompt, completion and request prices are zero. There is no paid or auto-router fallback. Free quotas are shared across the application; model rotation does not bypass account limits and cannot guarantee availability. Exhaustion is shown to users with manual reminders still available.

Messages and recent history are sent to OpenRouter and its providers only when chat is used. Diary sharing is off initially and visibly optional. If enabled, the server retrieves the authenticated account's selected-day foods, water and targets, excluding email, password, tokens and other accounts. Chat history stays in modal memory and clears on closing/account change. Apps Script keeps the generated reply in an account-scoped retry receipt for up to 30 days; it does not store the submitted conversation or diary context in that receipt. Expired receipts are pruned on subsequent writes. Provider processing/retention follows their policies; this is not on-device inference.

Reminder output is treated as untrusted data, validated, and rendered as a draft. Scheduling always happens in the existing reminder editor after user review and notification permission. Chat never directly changes food logs, goals or schedules. It cannot guarantee delivery or accurately predict a weight-loss date.

Reference: https://openrouter.ai/docs/guides/routing/model-fallbacks and https://openrouter.ai/docs/guides/routing/provider-selection
