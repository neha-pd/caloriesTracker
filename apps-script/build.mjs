import { build } from "esbuild";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const wrappers = {
  doPost: "post",
  doGet: "get",
  setupFitkin: "setup",
  showFitkinMigration: "showMigration",
  beginFitkinImport: "beginImport",
  importFitkinBatch: "importBatch",
  finishFitkinImport: "finishImport",
  showFitkinStatus: "showStatus",
  activateFitkin: "activate",
  onOpen: "menu",
  resetFitkinImport: "resetStaged",
};
fs.mkdirSync(root + "apps-script/dist", { recursive: true });
await build({
  entryPoints: [root + "apps-script/src/runtime.ts"],
  outfile: root + "apps-script/dist/Code.gs",
  bundle: true,
  format: "iife",
  globalName: "Fitkin",
  platform: "neutral",
  target: "es2020",
  minify: false,
  footer: {
    js: Object.entries(wrappers)
      .map(([name, fn]) => `function ${name}(e){return Fitkin.${fn}(e);}`)
      .join("\n"),
  },
});
fs.copyFileSync(
  root + "apps-script/appsscript.json",
  root + "apps-script/dist/appsscript.json",
);
fs.copyFileSync(
  root + "apps-script/dist/Code.gs",
  root + "apps-script/dist/Code.js",
);
console.log(
  "Ready: apps-script/dist/Code.gs (also Code.js) and appsscript.json",
);
