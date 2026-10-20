import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = process.argv[2];
if (!source)
  throw Error("Pass the export directory printed by npm run export:legacy.");
const data = JSON.parse(
  fs.readFileSync(path.join(source, "fitkin-migration.json"), "utf8"),
);
const secrets = JSON.parse(
  fs.readFileSync(path.join(root, ".data/deployment-credentials.json"), "utf8"),
);
const out = path.resolve(root, "../../Fitkin-Google-Setup");
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
fs.chmodSync(out, 0o700);
function put(name, text) {
  const file = path.join(out, name);
  fs.writeFileSync(file, text, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}
for (const name of ["Code.gs", "Code.js", "appsscript.json"])
  put(name, fs.readFileSync(path.join(root, "apps-script/dist", name)));
for (const name of ["fitkin-migration.json", "migration-report.json"])
  put(name, fs.readFileSync(path.join(source, name)));
const config = {
  OWNER_EMAIL: "nehadesai924117@gmail.com",
  FIREBASE_PROJECT_ID: "fitlens-b37f6",
  FIREBASE_API_KEY: "AIzaSyDsMmb8fF3tBvvCJ8Dy_7uGbp-nY8PQ_RY",
  ...(secrets.openrouter_api_key
    ? { OPENROUTER_API_KEY: secrets.openrouter_api_key }
    : {}),
};
put(
  "Configure.gs",
  `// Private local setup file. Do not commit or share. Run once, then remove from editor.\nfunction configureFitkin(){\n const config=${JSON.stringify(config, null, 2)};\n if(Session.getActiveUser().getEmail().toLowerCase()!==config.OWNER_EMAIL.toLowerCase())throw new Error('Open this script as its configured owner.');\n PropertiesService.getScriptProperties().setProperties(config,false);\n}\n`,
);
put(
  "ImportData.gs",
  `// Private migration snapshot. Keep the script private and remove this file after final import.
function importExistingFitkinData() {
  const replaceStaged = false; // Change to true ONLY to replace an unactivated rehearsal snapshot.
  return Fitkin.importSnapshot(${JSON.stringify(data)}, replaceStaged);
}
`,
);
put("START-HERE.md", fs.readFileSync(path.join(root, "docs/DEPLOYMENT.md")));
put(
  "SNAPSHOT.txt",
  `Exported: ${data.manifest.exportedAt}\nRecords: ${data.manifest.summary.count}\nSHA-256: ${data.manifest.summary.digest}\n\nThis is a rehearsal snapshot while the old API can still write. Stop old writes and export again for final cutover.\nNo data has been imported into Google yet.\n`,
);
console.log("Local browser setup package ready: " + out);
