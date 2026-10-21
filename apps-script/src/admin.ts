import { locked } from "./runtime";
import { recordSummary, canonical, validateRecords } from "./migration";
import type { Row } from "./store";
declare const PropertiesService: any,
  SpreadsheetApp: any,
  Session: any,
  HtmlService: any,
  Utilities: any,
  LockService: any;
const props = () => PropertiesService.getScriptProperties();
export function owner() {
  const expected = props().getProperty("OWNER_EMAIL");
  if (
    !expected ||
    Session.getActiveUser().getEmail().toLowerCase() !==
      expected.toLowerCase() ||
    Session.getEffectiveUser().getEmail().toLowerCase() !==
      expected.toLowerCase()
  )
    throw Error(
      "Only the configured owner can run migration tools. Run this script as its configured owner.",
    );
}
const hash = (s: string) =>
  Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    s,
    Utilities.Charset.UTF_8,
  )
    .map((b: number) => ((b + 256) % 256).toString(16).padStart(2, "0"))
    .join("");
export function setup() {
  owner();
  const p = props();
  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_API_KEY"])
    if (!p.getProperty(key))
      throw Error("Set " + key + " in Script properties first.");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000))
    throw Error("Setup is already running. Try again shortly.");
  try {
    // Reuse a saved ID before considering the active container. Never replace
    // a missing/inaccessible linked sheet with an empty database automatically.
    const existing = p.getProperty("SPREADSHEET_ID");
    let book = existing
      ? SpreadsheetApp.openById(existing)
      : SpreadsheetApp.getActiveSpreadsheet();
    let created = false;
    if (!book) {
      book = SpreadsheetApp.create("Fitkin private records");
      created = true;
    }
    p.setProperty("SPREADSHEET_ID", book.getId());
    let sheet = book.getSheetByName("Records");
    if (!sheet) {
      if (created) sheet = book.getSheets()[0].setName("Records");
      else sheet = book.insertSheet("Records");
    }
    const headers = ["kind", "record_id", "owner_id", "record_json"];
    if (sheet.getLastRow() === 0)
      sheet.getRange(1, 1, 1, 4).setValues([headers]);
    else if (
      JSON.stringify(sheet.getRange(1, 1, 1, 4).getValues()[0]) !==
      JSON.stringify(headers)
    )
      throw Error(
        "Records has unexpected columns. Setup stopped without overwriting data.",
      );
    sheet.setFrozenRows(1);
    if (!p.getProperty("MIGRATION_STATUS"))
      p.setProperty("MIGRATION_STATUS", "waiting");
    const result = {
      spreadsheetId: book.getId(),
      spreadsheetUrl: book.getUrl(),
      created,
      status: p.getProperty("MIGRATION_STATUS"),
    };
    console.log("Fitkin storage ready: " + result.spreadsheetUrl);
    return result;
  } finally {
    lock.releaseLock();
  }
}
export function beginImport(manifest: any) {
  owner();
  return locked((state) => {
    const p = props();
    if (p.getProperty("MIGRATION_STATUS") === "ready")
      throw Error("Live data cannot be overwritten by a migration.");
    if (
      !manifest ||
      manifest.schema !== 1 ||
      !Number.isInteger(manifest.summary?.count) ||
      manifest.summary.count < 0 ||
      !/^[a-f0-9]{64}$/.test(manifest.summary.digest)
    )
      throw Error("Invalid migration manifest.");
    const old = p.getProperty("IMPORT_MANIFEST");
    if (old && old !== JSON.stringify(manifest))
      throw Error(
        "A different import is already staged. Use the explicit staged-replacement option for a newer snapshot.",
      );
    if (!old && state.store.rows.size)
      throw Error("Import requires an empty Records sheet.");
    p.setProperty("IMPORT_MANIFEST", JSON.stringify(manifest));
    p.setProperty("MIGRATION_STATUS", "importing");
    return { ready: true };
  });
}
export function importBatch(rows: Row[]) {
  owner();
  return locked((state) => {
    if (props().getProperty("MIGRATION_STATUS") !== "importing")
      throw Error("Start an import first.");
    if (!Array.isArray(rows) || rows.length > 100)
      throw Error("Import up to 100 records at a time.");
    for (const r of rows) {
      if (
        !r ||
        !["user", "entry", "water", "fitness", "food", "xp"].includes(r.kind) ||
        typeof r.id !== "string" ||
        typeof r.owner !== "string" ||
        !r.value
      )
        throw Error("Invalid record.");
      const old = state.store.get(r.kind, r.id);
      if (old && canonical(old) !== canonical(r))
        throw Error("An existing record differs; import stopped.");
      state.store.put(r.kind, r.id, r.owner, r.value);
    }
    return { count: state.store.rows.size };
  });
}
export function finishImport() {
  owner();
  return locked((state) => {
    if (props().getProperty("MIGRATION_STATUS") !== "importing")
      throw Error("No import is in progress.");
    const rows = [...state.store.rows.values()];
    validateRecords(rows);
    const summary = recordSummary(rows, hash),
      expected = JSON.parse(
        props().getProperty("IMPORT_MANIFEST") || "{}",
      ).summary;
    if (canonical(summary) !== canonical(expected))
      throw Error(
        "Verification failed. Re-upload the same file to resume; do not open this backend to users.",
      );
    props().setProperty("MIGRATION_STATUS", "verified");
    return {
      verified: true,
      counts: summary.counts,
      records: summary.count,
      digest: summary.digest,
    };
  });
}
export function migrationStatus() {
  owner();
  return {
    status: props().getProperty("MIGRATION_STATUS"),
    spreadsheetId: props().getProperty("SPREADSHEET_ID"),
  };
}
export function activate() {
  owner();
  return locked(() => {
    if (props().getProperty("MIGRATION_STATUS") !== "verified")
      throw Error("Verify the complete import first.");
    props().setProperty("MIGRATION_STATUS", "ready");
    return { ready: true };
  });
}
export function resetStaged(confirmation?: string) {
  owner();
  if (confirmation !== "RESET_STAGED_IMPORT") {
    if (!SpreadsheetApp.getActiveSpreadsheet())
      throw Error(
        "For a standalone script, set replaceStaged = true in ImportData.gs and run importExistingFitkinData.",
      );
    const ui = SpreadsheetApp.getUi();
    if (
      ui.alert(
        "Reset staged import?",
        "This clears only the unactivated spreadsheet copy. The original database and local export remain untouched.",
        ui.ButtonSet.YES_NO,
      ) !== ui.Button.YES
    )
      return;
  }
  locked((state) => {
    if (props().getProperty("MIGRATION_STATUS") === "ready")
      throw Error("A live backend cannot be reset by the importer.");
    props().setProperty("MIGRATION_STATUS", "waiting");
    for (const row of [...state.store.rows.values()])
      state.store.remove(row.kind, row.id);
  });
  props().deleteProperty("IMPORT_MANIFEST");
  props().setProperty("MIGRATION_STATUS", "waiting");
}
/** Editor-run import for standalone projects; never exposed by the public RPC router. */
export function importSnapshot(
  snapshot: { manifest: any; rows: Row[] },
  replaceStaged = false,
) {
  owner();
  if (!snapshot || !Array.isArray(snapshot.rows))
    throw Error("Invalid migration file.");
  validateRecords(snapshot.rows);
  if (
    snapshot.manifest?.schema !== 1 ||
    canonical(recordSummary(snapshot.rows, hash)) !==
      canonical(snapshot.manifest.summary)
  )
    throw Error(
      "Migration file failed verification. Existing data was not changed.",
    );
  if (replaceStaged) resetStaged("RESET_STAGED_IMPORT");
  beginImport(snapshot.manifest);
  for (let i = 0; i < snapshot.rows.length; i += 100)
    importBatch(snapshot.rows.slice(i, i + 100));
  const result = finishImport();
  console.log(JSON.stringify(result));
  return result;
}
export function menu() {
  if (!SpreadsheetApp.getActiveSpreadsheet()) return;
  SpreadsheetApp.getUi()
    .createMenu("Fitkin")
    .addItem("Import existing data", "showFitkinMigration")
    .addItem("Check migration status", "showFitkinStatus")
    .addItem("Reset staged import", "resetFitkinImport")
    .addToUi();
}
export function showStatus() {
  owner();
  const status = migrationStatus();
  console.log(JSON.stringify(status));
  return status;
}
export function showMigration() {
  owner();
  if (!SpreadsheetApp.getActiveSpreadsheet())
    throw Error(
      "Use ImportData.gs and run importExistingFitkinData in this standalone project.",
    );
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(
      `<!doctype html><html><head><base target="_top"><style>body{font:15px system-ui;padding:20px;line-height:1.6}button,input{margin:12px 0;padding:12px}pre{white-space:pre-wrap}button{cursor:pointer}</style></head><body><h2>Move your Fitkin records</h2><p>Choose the private <b>fitkin-migration.json</b> file. Keep this window open until every record is verified. A partial upload can be resumed with the same file.</p><input id="file" type="file" accept=".json"><button id="upload">Import & verify</button><pre id="status" role="status"></pre><button id="activate" hidden>Activate this backend</button><p>Activate only after the final snapshot was exported with old writes stopped. Keep the old database backup.</p><script>
const status=document.getElementById('status'),button=document.getElementById('upload'),activate=document.getElementById('activate');
function call(name,...args){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args));}
button.onclick=async()=>{button.disabled=true;activate.hidden=true;try{const file=document.getElementById('file').files[0];if(!file)throw Error('Choose the migration JSON file.');const data=JSON.parse(await file.text());await call('beginFitkinImport',data.manifest);for(let i=0;i<data.rows.length;i+=100){status.textContent='Importing '+i+' / '+data.rows.length;await call('importFitkinBatch',data.rows.slice(i,i+100));}const result=await call('finishFitkinImport');status.textContent=JSON.stringify(result,null,2);activate.hidden=false;}catch(e){status.textContent=e.message||String(e);}finally{button.disabled=false;}};
activate.onclick=async()=>{activate.disabled=true;try{await call('activateFitkin');status.textContent+='\\nBackend activated. Deploy the web app, then copy its /exec URL.';}catch(e){status.textContent=e.message||String(e);activate.disabled=false;}};
</script></body></html>`,
    )
      .setWidth(600)
      .setHeight(580),
    "Fitkin data migration",
  );
}
