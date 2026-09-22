# Fitkin project website

Static GitHub Pages site, written in Neha’s voice. No build, paid service, account, analytics or third-party runtime requests are required.

Preview from the repository root:

```sh
python3 -m http.server 8088 --directory website
```

Visit http://localhost:8088. `index.html` owns the story and links; `style.css` owns the responsive theme; `site.js` adds optional, reduced-motion-aware reveals. Screenshots use the app’s fictional demo.

## Publishing

A repository administrator must select **Settings → Pages → Build and deployment → Source → GitHub Actions** once. Then run **Actions → Publish Fitkin website → Run workflow**. Subsequent website commits to `main` publish automatically.

Expected address: https://neha-pd.github.io/caloriesTracker/ . If the repository is renamed to `fitkin`, Pages moves to https://neha-pd.github.io/fitkin/; relative assets continue working and the workflow updates the social image URL. Update the documented website link after a rename.

## Design and assets

Direction informed by [Taste skill](https://github.com/Leonxlnx/taste-skill/blob/5217fb45be2c0b302f29c9cd31cbd3237501c684/skills/taste-skill/SKILL.md): a playful personal project page, asymmetric hero, real product imagery, consistent lime accent and restrained motion. Dials: variance 7, motion 4, density 3. Plain HTML/CSS keeps this GitHub Pages site independent of the app build. System light/dark themes, keyboard focus, a skip link, responsive layouts and reduced motion are included.

Kin is the project’s generated brand asset; see [icon provenance and prompt](../docs/branding/FITKIN_ICON.md). Outfit is self-hosted from `@fontsource-variable/outfit` 5.3.0, licensed under the included SIL Open Font License. No external font request is needed.
