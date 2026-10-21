import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

// Run the shipped bundle against a spreadsheet/trigger harness, including
// repeated setup and a timer execution where ActiveUser is unavailable.
test("dashboard setup is repeatable, owner-only and never writes application records", () => {
  const props = new Map(
    Object.entries({
      OWNER_EMAIL: "owner@example.com",
      SPREADSHEET_ID: "private",
    }),
  );
  const cache = new Map<string, string>(),
    tabs = new Map<string, any>(),
    batches: any[] = [];
  let active = "owner@example.com",
    held = false;
  const triggers: any[] = [];
  const fluent = (methods: string[]) => {
    const target: any = {};
    for (const name of methods) target[name] = () => target;
    return target;
  };
  function sheet(name: string) {
    let rows = 1000;
    const target: any = fluent([
      "setHiddenGridlines",
      "setTabColor",
      "setFrozenRows",
      "setRowHeight",
      "setColumnWidths",
      "setColumnWidth",
      "setRowHeights",
      "clear",
      "insertChart",
      "removeChart",
    ]);
    target.getMaxRows = () => rows;
    target.getMaxColumns = () => 26;
    target.insertRowsAfter = (_n: number, amount: number) => {
      rows += amount;
      return target;
    };
    target.getRange = (..._args: any[]) => {
      const range = fluent([
        "setFontFamily",
        "setFontSize",
        "setBackground",
        "setFontColor",
        "setFontWeight",
        "setWrap",
        "merge",
      ]);
      range.setValue = range.setValues = () => {
        assert.notEqual(name, "Records");
        return range;
      };
      return range;
    };
    target.getCharts = () => [];
    target.newChart = () =>
      fluent(["asLineChart", "addRange", "setPosition", "setOption", "build"]);
    return target;
  }
  tabs.set("Records", sheet("Records"));
  const book = {
    getSheetByName: (n: string) => tabs.get(n),
    insertSheet: (n: string) => {
      const s = sheet(n);
      tabs.set(n, s);
      return s;
    },
    setActiveSheet: () => {},
    getUrl: () => "https://docs.google.com/spreadsheets/d/private/edit",
  };
  const context: any = {
    console: { log: () => {} },
    URL,
    Date,
    Intl,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) || null,
        setProperty: (k: string, v: string) => props.set(k, v),
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => active }),
      getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }),
    },
    SpreadsheetApp: { openById: () => book },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k),
        put: (k: string, v: string) => cache.set(k, v),
        getAll: (ks: string[]) =>
          Object.fromEntries(
            ks.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)]),
          ),
        removeAll: (ks: string[]) => ks.forEach((k) => cache.delete(k)),
        remove: (k: string) => cache.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          assert.equal(held, false);
          held = true;
          return true;
        },
        releaseLock: () => {
          held = false;
        },
      }),
    },
    ScriptApp: {
      getService: () => ({
        getUrl: () => "https://script.google.com/macros/s/test/exec",
      }),
      getProjectTriggers: () => triggers,
      newTrigger: (name: string) => ({
        timeBased: () => ({
          everyMinutes: (n: number) => {
            assert.equal(n, 5);
            return {
              create: () =>
                triggers.push({
                  getHandlerFunction: () => name,
                  getUniqueId: () => "123",
                }),
            };
          },
        }),
      }),
      deleteTrigger: (t: any) => triggers.splice(triggers.indexOf(t), 1),
    },
    Sheets: {
      Spreadsheets: {
        Values: {
          batchGet: (_id: string, args: any) => {
            assert.equal(active, "owner@example.com");
            assert.equal(args.ranges.length, 4);
            return {
              valueRanges: [
                {
                  values: [
                    [
                      new Date().toISOString(),
                      "/api/v2/water/:id",
                      200,
                      120,
                      3,
                      20,
                      30,
                      1,
                      0,
                      "private-account-hash",
                    ],
                  ],
                },
                { values: [[3, "", 6, "", 2, "", 4]] },
                {
                  values: [
                    ["Last refreshed: " + new Date().toISOString() + " · UTC"],
                  ],
                },
                { values: [["user", 3, "App records"]] },
              ],
            };
          },
          get: (_id: string, range: string) => ({
            values:
              range === "Records!A2:D"
                ? [
                    ["user", "u", "u", "{}"],
                    ["fitness", "f", "u", '{"kind":"workout"}'],
                  ]
                : [],
          }),
          batchUpdate: (b: any) => {
            assert.equal(
              held,
              false,
              "dashboard writes must release the app lock",
            );
            assert.equal(b.valueInputOption, "RAW");
            assert(b.data.every((d: any) => !d.range.includes("Records")));
            batches.push(b);
          },
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(new URL("../dist/Code.gs", import.meta.url), "utf8"),
    context,
  );
  context.setupFitkinDashboard();
  context.setupFitkinDashboard();
  assert.equal(triggers.length, 1);
  assert.equal(tabs.size, 6);
  assert.equal(props.get("ADMIN_METRICS"), "on");
  assert.equal(batches.length, 2);
  const find = (cell: string) =>
    batches.at(-1).data.find((d: any) => d.range === cell).values[0][0];
  assert.equal(find("Admin!A6"), 1);
  assert.equal(find("Admin!E6"), 1);
  assert.equal(find("Admin!E11"), "No samples yet");
  const dashboard = context.getFitkinDashboardData({ days: 7 });
  assert.equal(dashboard.counts.accounts, 3);
  assert.equal(dashboard.requests, 1);
  assert.equal(dashboard.routes[0].route, "/api/v2/water/:id");
  assert.equal(dashboard.recent[0].actor, undefined);
  assert.equal(
    JSON.stringify(dashboard).includes("private-account-hash"),
    false,
  );
  assert.match(context.openFitkinDashboard(), /exec\?view=admin$/);
  active = "";
  assert.throws(
    () => context.getFitkinDashboardData({ refresh: true }),
    /Only the configured owner/,
  );
  assert.throws(
    () => context.openFitkinDashboard(),
    /Only the configured owner/,
  );
  assert.throws(
    () => context.setupFitkinDashboard(),
    /Only the configured owner/,
  );
  assert.throws(
    () => context.refreshFitkinDashboard({ triggerUid: "forged" }),
    /Only the owner/,
  );
  const result = context.refreshFitkinDashboard({ triggerUid: "123" });
  assert.equal(result.ready, true);
  assert.equal(result.accounts, 1);
  assert.equal(held, false);
});
