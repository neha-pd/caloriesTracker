import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const bundle = fs.readFileSync(
  new URL("../dist/Code.gs", import.meta.url),
  "utf8",
);
function setupFixture() {
  const properties = new Map<string, string>([
    ["OWNER_EMAIL", "owner@example.com"],
    ["FIREBASE_PROJECT_ID", "fitlens-b37f6"],
    ["FIREBASE_API_KEY", "public-key"],
  ]);
  let email = "owner@example.com",
    created = 0,
    blocked = false,
    failHeaders = false,
    active: any = null;
  const books = new Map<string, any>();
  function makeBook(id: string, hasRecords = false) {
    let name = hasRecords ? "Records" : "Sheet1",
      cells: any[][] = hasRecords
        ? [
            ["kind", "record_id", "owner_id", "record_json"],
            ["user", "existing", "firebase-uid", "{}"],
          ]
        : [];
    const sheet = {
      getLastRow: () => cells.length,
      setName: (n: string) => {
        name = n;
        return sheet;
      },
      setFrozenRows: () => {},
      getRange: (row: number) => ({
        getValues: () => [cells[row - 1]],
        setValues: (v: any[][]) => {
          if (failHeaders) throw Error("Temporary write failure");
          cells = v;
        },
      }),
    };
    const book = {
      getId: () => id,
      getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
      getSheetByName: (n: string) => (name === n ? sheet : null),
      getSheets: () => [sheet],
      insertSheet: (n: string) => {
        name = n;
        cells = [];
        return sheet;
      },
      cells: () => cells,
    };
    books.set(id, book);
    return book;
  }
  const context: any = {
    console: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => properties.get(k) || null,
        setProperty: (k: string, v: string) => properties.set(k, v),
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => email }),
      getEffectiveUser: () => ({ getEmail: () => email }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => !blocked, releaseLock: () => {} }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => active,
      create: () => {
        created++;
        return makeBook("created-" + created);
      },
      openById: (id: string) => {
        if (!books.has(id)) throw Error("Missing or inaccessible spreadsheet");
        return books.get(id);
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(bundle, context);
  return {
    run: () => context.setupFitkin(),
    properties,
    books,
    makeBook,
    created: () => created,
    owner: (value: string) => {
      email = value;
    },
    block: () => {
      blocked = true;
    },
    failHeaders: (v: boolean) => {
      failHeaders = v;
    },
    bind: (b: any) => {
      active = b;
    },
  };
}
test("standalone setup creates its spreadsheet, initializes Records and reuses it on repeat", () => {
  const s = setupFixture(),
    first = s.run();
  assert.equal(first.created, true);
  assert.equal(
    first.spreadsheetUrl,
    "https://docs.google.com/spreadsheets/d/created-1/edit",
  );
  assert.equal(s.properties.get("SPREADSHEET_ID"), "created-1");
  assert.equal(s.properties.get("MIGRATION_STATUS"), "waiting");
  assert.equal(
    s.books.get("created-1").cells()[0].join(","),
    "kind,record_id,owner_id,record_json",
  );
  s.properties.set("MIGRATION_STATUS", "ready");
  const second = s.run();
  assert.equal(second.created, false);
  assert.equal(s.created(), 1);
  assert.equal(s.properties.get("MIGRATION_STATUS"), "ready");
});
test("bound setup uses the existing container and preserves existing Records", () => {
  const s = setupFixture(),
    book = s.makeBook("bound", true);
  s.bind(book);
  const before = JSON.stringify(book.cells());
  assert.equal(s.run().spreadsheetId, "bound");
  assert.equal(s.created(), 0);
  assert.equal(JSON.stringify(book.cells()), before);
});
test("saved storage wins over another active sheet, and missing saved storage never creates an empty replacement", () => {
  const s = setupFixture();
  s.makeBook("original", true);
  s.bind(s.makeBook("other"));
  s.properties.set("SPREADSHEET_ID", "original");
  assert.equal(s.run().spreadsheetId, "original");
  assert.equal(s.created(), 0);
  s.properties.set("SPREADSHEET_ID", "missing");
  assert.throws(() => s.run(), /inaccessible/);
  assert.equal(s.created(), 0);
});
test("partial setup remembers the new spreadsheet so retry does not make duplicates", () => {
  const s = setupFixture();
  s.failHeaders(true);
  assert.throws(() => s.run(), /Temporary/);
  assert.equal(s.properties.get("SPREADSHEET_ID"), "created-1");
  s.failHeaders(false);
  s.run();
  assert.equal(s.created(), 1);
});
test("wrong owner, missing configuration and simultaneous setup cannot create sheets", () => {
  const wrong = setupFixture();
  wrong.owner("other@example.com");
  assert.throws(() => wrong.run(), /configured owner/);
  assert.equal(wrong.created(), 0);
  const missing = setupFixture();
  missing.properties.delete("FIREBASE_API_KEY");
  assert.throws(() => missing.run(), /FIREBASE_API_KEY/);
  assert.equal(missing.created(), 0);
  const busy = setupFixture();
  busy.block();
  assert.throws(() => busy.run(), /already running/);
  assert.equal(busy.created(), 0);
});
