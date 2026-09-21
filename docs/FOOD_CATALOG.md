# Offline food library

FitLens includes 13,681 records: 5,431 USDA FNDDS 2021–2023 foods, 8,104 additional SR Legacy/Foundation records, and 146 original home-style Indian recipe estimates. India-focused aliases also improve search in English and several Indian scripts. This is not an exhaustive worldwide catalogue.

USDA data is public domain/CC0: https://fdc.nal.usda.gov/download-datasets/ . Source identifiers and nutrition are preserved, and all library values use a 100 g basis. USDA portion weights are supplied where available. SR Legacy is historical (2018), so users should prefer current package labels for branded foods.

## Rebuild

Place the official archives in `.data/food-import/sr.zip` and `foundation.zip`:

- https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
- https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip

Run `python3 scripts/expand_foods.py`, then `python3 scripts/build_indian_foods.py` from the repository root. The latter uses the original specifications in `data/food-recipes/indian.json`. `mobile/src/data/food-aliases.json` supplies curated regional search terms. The importer rejects incomplete or invalid macronutrients and preserves existing FNDDS identifiers so saved diaries still resolve.

## Recipe estimates

Recipe records are calculations, not measured nutrient analyses or official Indian food composition tables. Ingredient weights are multiplied by USDA nutrients and divided by an assumed cooked yield. Cooking loss, oil uptake and regional variation are not measured. Some source ingredients are proxies, documented in each recipe note. The UI labels estimates and exposes the full assumptions before logging. Users can create their own food from labels or a preferred calculation.

Tests cover uniqueness, nonnegative finite nutrients, stable IDs, aliases, India-only search and recipe assumptions. Search and all library data work without an API connection.
