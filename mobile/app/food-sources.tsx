import React from "react";
import { Linking } from "react-native";
import { Page, Card, T, C, Button } from "../src/features/ui";
import { foods, indianFoodCount } from "../src/features/catalog";
export default function Sources() {
  return (
    <Page back eyebrow="KNOW YOUR FOOD" title="What’s in the library?">
      <Card>
        <T bold>{foods.length.toLocaleString()} searchable foods</T>
        <T>
          {indianFoodCount} India-focused entries and regional aliases,
          alongside international ingredients and dishes. This is a growing
          library, not every food in the world.
        </T>
      </Card>
      <Card>
        <T bold>USDA FoodData Central</T>
        <T>
          FNDDS 2021–2023, SR Legacy (2018) and Foundation Foods (April 2026).
          Nutrition is per 100 g, with common portions where supplied.
          Historical branded entries may differ from today’s product label.
        </T>
        <Button
          secondary
          title="Visit USDA data sources"
          onPress={() =>
            void Linking.openURL("https://fdc.nal.usda.gov/download-datasets/")
          }
        />
      </Card>
      <Card>
        <T bold>Home-style Indian recipes</T>
        <T>
          146 original recipe estimates calculated from ingredient weights and
          assumed cooked yields. They are not laboratory measurements. Open a
          food to see ingredients, yield and any substitute used in the
          calculation. Your recipe may use different oil, water or portions.
        </T>
      </Card>
      <T color={C.muted}>
        Confirm portions and package labels. Save a custom food when your meal
        differs. This library works offline; chat is optional.
      </T>
    </Page>
  );
}
