# Contributing to Fitkin

Welcome! We welcome practical feedback and contributions from people of any experience level.

## You don’t have to write code

Try the demo, tell us which screen confused you, suggest an Indian food or regional search name, or test a release on your phone. Use the [issue templates](https://github.com/neha-pd/caloriesTracker/issues/new/choose) so we have enough detail to help.

For nutrition corrections, include a reliable source, units and serving size. Keep calculated recipe estimates clearly separate from measured nutrition data.

## Making a code change

1. Check existing issues and pull requests. For a large feature, open an issue first so we can discuss the user need and scope.
2. Fork the repository and create a branch for one focused change.
3. Follow the [README setup](README.md#run-it-locally). Use local services and fictional data for tests.
4. Make the smallest complete change that solves the problem. Keep labels plain, make the next action obvious, and avoid adding settings people don’t need.
5. Run `npm run typecheck` and `npm test`. For UI changes, export the web app and run the relevant browser checks from `checks/`; include a screenshot with sample data. Native changes need a native build and relevant device testing.
6. Open a pull request explaining the problem, resulting behavior, checks performed and anything still unverified.

## Things we take care with

- Do not commit `.env` files, database credentials, Firebase service accounts, API keys, signing keys or personal health data.
- Keep offline retries safe and records isolated between accounts.
- Avoid double-counting watch and manual activity. Missing health readings must not become zero or invented estimates.
- Keep chat optional and free-only. Reminder drafts must remain reviewable before scheduling.
- Document data sources and preserve third-party notices. Contributions to original project code use the repository’s MIT license.

## Reporting a problem

Include the app version, phone/OS or browser, steps to reproduce, expected behavior and what happened. Screenshots help, but remove names, email addresses and health details first. Never post credentials or sensitive security details in a public issue; use GitHub private vulnerability reporting if it is enabled.

Be kind and specific. This is a learning project, and everyone should feel comfortable asking a question or suggesting a better way.
