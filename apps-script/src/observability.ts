import { owner } from "./admin";
declare const PropertiesService: any,
  CacheService: any,
  LockService: any,
  SpreadsheetApp: any,
  Sheets: any,
  ScriptApp: any,
  Utilities: any,
  Session: any;
const headers = [
  "Recorded at (UTC)",
  "Route",
  "Status",
  "Server ms",
  "Lock wait ms",
  "Read ms",
  "Write ms",
  "Operations",
  "Rejected operations",
  "Account hash",
];
const minuteKey = (minute: number) => "fitkin:api:" + minute;
export type Metric = {
  at: string;
  route: string;
  status: number;
  ms: number;
  lockMs: number;
  readMs: number;
  writeMs: number;
  operations: number;
  rejected: number;
  actor: string;
};
export function bufferMetric(metric: Metric) {
  // Observability must never make a successful app request fail or wait on
  // another request's storage lock. No prompts, tokens or diary data are logged.
  try {
    if (
      PropertiesService.getScriptProperties().getProperty("ADMIN_METRICS") !==
      "on"
    )
      return;
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20)) return;
    try {
      const cache = CacheService.getScriptCache(),
        key = minuteKey(Math.floor(Date.now() / 60000));
      const rows = JSON.parse(cache.get(key) || "[]");
      if (rows.length < 150) {
        rows.push(metric);
        cache.put(key, JSON.stringify(rows), 21600);
      }
    } finally {
      lock.releaseLock();
    }
  } catch {
    /* Best-effort metrics never block app data. */
  }
}
export function routeLabel(path: unknown) {
  if (typeof path !== "string") return "invalid";
  if (
    /^\/api\/(?:auth\/(?:session|logout)|users\/me(?:\/(?:goals|settings|export))?|v[23]\/(?:snapshot|batch|check-in|chat(?:\/status)?|sync))$/.test(
      path,
    )
  )
    return path;
  const m = path.match(
    /^\/api\/v2\/(entries|water|fitness|foods\/custom)(?:\/[\w-]+)?$/,
  );
  return m ? "/api/v2/" + m[1] + "/:id" : "other";
}
export function aggregateMetrics(rows: any[][]) {
  const groups = new Map<string, any>();
  for (const r of rows) {
    const date = String(r[0]).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = groups.get(date) || {
      actors: new Set(),
      latencies: [],
      requests: 0,
      errors: 0,
      ops: 0,
      rejected: 0,
    };
    day.requests++;
    day.errors += Number(r[2]) >= 400 ? 1 : 0;
    day.ops += Number(r[7]) || 0;
    day.rejected += Number(r[8]) || 0;
    if (r[9]) day.actors.add(String(r[9]));
    if (Number.isFinite(Number(r[3]))) day.latencies.push(Number(r[3]));
    groups.set(date, day);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const sorted = d.latencies.sort((a: number, b: number) => a - b),
        pct = (n: number) =>
          sorted[Math.max(0, Math.ceil(sorted.length * n) - 1)] || 0;
      return [
        date,
        d.actors.size,
        d.requests,
        d.errors,
        d.ops,
        d.rejected,
        pct(0.5),
        pct(0.95),
      ];
    });
}
const names = ["Admin", "Daily Usage", "API Requests", "Storage", "Read Me"];
export function setupDashboard() {
  owner();
  const props = PropertiesService.getScriptProperties(),
    book = SpreadsheetApp.openById(props.getProperty("SPREADSHEET_ID"));
  for (const name of names) {
    const sheet = book.getSheetByName(name) || book.insertSheet(name);
    sheet.setHiddenGridlines(true);
    sheet.setTabColor(name === "Admin" ? "#b6e85a" : "#536847");
    sheet
      .getRange(1, 1, sheet.getMaxRows(), Math.min(sheet.getMaxColumns(), 10))
      .setFontFamily("Arial")
      .setFontSize(10);
    if (name !== "Admin") {
      sheet.setFrozenRows(1);
      sheet
        .getRange(1, 1, 1, 10)
        .setBackground("#162119")
        .setFontColor("#e0f4ca")
        .setFontWeight("bold");
      sheet.setRowHeight(1, 38);
      sheet.setColumnWidths(1, 10, 150);
    }
  }
  const admin = book.getSheetByName("Admin");
  admin.clear();
  admin.getRange("A1:H28").setBackground("#f2f4ec").setFontColor("#18241b");
  admin.setColumnWidths(1, 8, 142);
  admin.setRowHeights(1, 28, 32);
  admin
    .getRange("A1:H2")
    .merge()
    .setValue("FITKIN  /  ADMIN OVERVIEW")
    .setFontSize(26)
    .setFontWeight("bold")
    .setBackground("#162119")
    .setFontColor("#d1fa70");
  admin
    .getRange("A3:H3")
    .merge()
    .setValue("Private workspace · operational metrics refresh every 5 minutes")
    .setFontColor("#596b51");
  for (const [label, col] of [
    ["App accounts", 1],
    ["Food records", 3],
    ["Workout records", 5],
    ["Water records", 7],
  ] as const) {
    admin
      .getRange(5, col, 1, 2)
      .merge()
      .setValue(label)
      .setFontWeight("bold")
      .setBackground("#e1ebd6");
    admin
      .getRange(6, col, 2, 2)
      .merge()
      .setFontSize(32)
      .setFontWeight("bold")
      .setBackground("#e1ebd6");
  }
  admin
    .getRange("A9:H9")
    .merge()
    .setValue("RECENT API ACTIVITY  /  LAST 24 HOURS")
    .setFontWeight("bold");
  for (const [label, col] of [
    ["Requests observed", 1],
    ["Error requests", 3],
    ["Typical server time", 5],
    ["p95 server time", 7],
  ] as const) {
    admin
      .getRange(10, col, 1, 2)
      .merge()
      .setValue(label)
      .setFontColor("#596b51");
    admin.getRange(11, col, 2, 2).merge().setFontSize(24).setFontWeight("bold");
  }
  admin
    .getRange("A14:H14")
    .merge()
    .setValue(
      "Server processing time includes auth, lock and Sheets work; excludes browser/network delivery.",
    )
    .setFontSize(11);
  admin
    .getRange("A15:H15")
    .merge()
    .setValue(
      "Metrics are best-effort observations, not a billing or complete visitor count. Demo/offline activity is not reported.",
    )
    .setFontSize(10)
    .setFontColor("#596b51");
  admin
    .getRange("A17:H17")
    .merge()
    .setValue(
      "OPEN A TAB BELOW  →  Daily Usage · API Requests · Storage · Read Me",
    )
    .setFontWeight("bold");
  admin.getRange("A19:H19").merge();
  admin
    .getRange("A20:H20")
    .merge()
    .setValue(
      "Records is the app’s source of truth. Never sort, edit or delete rows there manually.",
    )
    .setFontColor("#82452b");
  const req = book.getSheetByName("API Requests");
  req.getRange(1, 1, 1, headers.length).setValues([headers]);
  req.setColumnWidth(1, 210);
  req.setColumnWidth(2, 260);
  const usage = book.getSheetByName("Daily Usage");
  usage
    .getRange(1, 1, 1, 8)
    .setValues([
      [
        "Date (UTC)",
        "Active accounts observed",
        "Requests observed",
        "Error requests",
        "Operations",
        "Rejected operations",
        "Median server ms",
        "p95 server ms",
      ],
    ]);
  usage.setColumnWidth(2, 210);
  book
    .getSheetByName("Storage")
    .getRange(1, 1, 1, 3)
    .setValues([["Record type", "Rows", "Purpose"]]);
  const help = book.getSheetByName("Read Me");
  help.setColumnWidth(1, 250);
  help.setColumnWidth(2, 850);
  help.getRange(1, 1, 8, 2).setValues([
    ["FITKIN ADMIN", "How to read this workspace"],
    [
      "Privacy",
      "Keep the whole spreadsheet private. Tabs contain operational metadata and Records contains account data.",
    ],
    [
      "Timing",
      "Server ms runs from Apps Script handler entry through processing. Lock/read/write columns explain backend work; network and client render time are not measured.",
    ],
    [
      "Coverage",
      "Request samples use a short-lived cache to avoid slowing users. Cache eviction, contention or failed flushes can omit samples. No historical timings exist before this update.",
    ],
    [
      "Retention",
      "The latest 5,000 API samples (up to 14 days) are retained. Usage charts summarize those retained samples, not lifetime analytics.",
    ],
    [
      "Refresh",
      "A 5-minute trigger refreshes this dashboard. Run refreshFitkinDashboard in Apps Script to refresh manually. It never changes app records.",
    ],
    [
      "Batch sync",
      "Up to 20 queued operations share one auth check and one atomic write. Item failures are reported individually; request IDs prevent duplicate logs and XP.",
    ],
    [
      "App accounts",
      "Counts non-deleting profiles in Records. Offline demos, local training plans and Firebase-only identities without an app profile are not included.",
    ],
  ]);
  help.getRange("A1:B8").setWrap(true);
  help.setRowHeights(2, 7, 65);
  const records = book.getSheetByName("Records");
  if (records) {
    records.setFrozenRows(1);
    records
      .getRange("A1:D1")
      .setBackground("#162119")
      .setFontColor("#e0f4ca")
      .setFontWeight("bold");
  }
  props.setProperty("ADMIN_METRICS", "on");
  const triggers = ScriptApp.getProjectTriggers().filter(
    (t: any) => t.getHandlerFunction() === "refreshFitkinDashboard",
  );
  if (!triggers.length)
    ScriptApp.newTrigger("refreshFitkinDashboard")
      .timeBased()
      .everyMinutes(5)
      .create();
  for (const duplicate of triggers.slice(1)) ScriptApp.deleteTrigger(duplicate);
  // Rebuild only our charts; no third-party sheets are touched.
  for (const chart of admin.getCharts()) admin.removeChart(chart);
  admin.insertChart(
    admin
      .newChart()
      .asLineChart()
      .addRange(usage.getRange("A1:A16"))
      .addRange(usage.getRange("C1:C16"))
      .setPosition(23, 1, 0, 0)
      .setOption("title", "API requests observed per day")
      .setOption("width", 550)
      .setOption("height", 290)
      .setOption("colors", ["#648c32"])
      .build(),
  );
  admin.insertChart(
    admin
      .newChart()
      .asLineChart()
      .addRange(usage.getRange("A1:A16"))
      .addRange(usage.getRange("G1:H16"))
      .setPosition(23, 5, 0, 0)
      .setOption("title", "Server latency (ms): median / p95")
      .setOption("width", 550)
      .setOption("height", 290)
      .build(),
  );
  refreshDashboard();
  book.setActiveSheet(admin);
  console.log("Fitkin admin ready: " + book.getUrl());
  return { ready: true, url: book.getUrl() };
}
export function refreshDashboard(event?: { triggerUid?: string }) {
  if (event?.triggerUid) {
    const expected =
      PropertiesService.getScriptProperties().getProperty("OWNER_EMAIL");
    if (
      Session.getEffectiveUser().getEmail().toLowerCase() !==
        expected?.toLowerCase() ||
      !ScriptApp.getProjectTriggers().some(
        (t: any) =>
          t.getHandlerFunction() === "refreshFitkinDashboard" &&
          String(t.getUniqueId()) === String(event.triggerUid),
      )
    )
      throw Error(
        "Only the owner’s dashboard trigger can refresh automatically.",
      );
  } else owner();
  const props = PropertiesService.getScriptProperties(),
    id = props.getProperty("SPREADSHEET_ID");
  if (props.getProperty("ADMIN_METRICS") !== "on") return { enabled: false };
  const cache = CacheService.getScriptCache(),
    lock = LockService.getScriptLock();
  if (!lock.tryLock(100)) return { busy: true };
  let metrics: Metric[] = [];
  try {
    if (cache.get("fitkin:admin:refreshing")) return { busy: true };
    cache.put("fitkin:admin:refreshing", "1", 120);
    const minute = Math.floor(Date.now() / 60000),
      keys = Array.from({ length: 61 }, (_, i) => minuteKey(minute - i)),
      values = cache.getAll(keys);
    metrics = Object.values(values).flatMap((v) => JSON.parse(String(v)));
    cache.removeAll(keys);
  } finally {
    lock.releaseLock();
  }
  try {
    const now = Date.now(),
      raw =
        Sheets.Spreadsheets.Values.get(id, "'API Requests'!A2:J").values || [];
    const rows = [
      ...raw,
      ...metrics.map((m) => [
        m.at,
        m.route,
        m.status,
        m.ms,
        m.lockMs,
        m.readMs,
        m.writeMs,
        m.operations,
        m.rejected,
        m.actor,
      ]),
    ]
      .filter((r) => Date.parse(r[0]) > now - 14 * 86400000)
      .sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]))
      .slice(-5000);
    const stored =
        Sheets.Spreadsheets.Values.get(id, "Records!A2:D").values || [],
      counts: Record<string, number> = {};
    for (const row of stored) {
      if (!row[0]) continue;
      let v;
      try {
        v = JSON.parse(row[3]);
      } catch {
        continue;
      }
      if (v.deleting || v.deleted_at) continue;
      counts[row[0]] = (counts[row[0]] || 0) + 1;
    }
    const book = SpreadsheetApp.openById(id),
      log = book.getSheetByName("API Requests");
    if (log.getMaxRows() < rows.length + 1)
      log.insertRowsAfter(log.getMaxRows(), rows.length + 1 - log.getMaxRows());
    const recent = rows.filter((r) => Date.parse(r[0]) > now - 86400000),
      lat = recent.map((r) => Number(r[3])).sort((a, b) => a - b),
      pct = (q: number) =>
        lat.length
          ? Math.round(lat[Math.max(0, Math.ceil(lat.length * q) - 1)]) + " ms"
          : "No samples yet";
    const usage = aggregateMetrics(rows),
      storage = Object.entries(counts)
        .sort()
        .map(([kind, n]) => [
          kind,
          n,
          kind === "receipt"
            ? "Retry protection"
            : kind === "session"
              ? "Hashed device sessions"
              : "App records",
        ]);
    const values = [
      {
        range:
          "'API Requests'!A2:J" + (Math.max(rows.length, raw.length, 1) + 1),
        values: [
          ...rows,
          ...Array.from({ length: Math.max(0, raw.length - rows.length) }, () =>
            Array(10).fill(""),
          ),
        ],
      },
      {
        range: "'Daily Usage'!A2:H30",
        values: [
          ...usage,
          ...Array.from({ length: 29 - usage.length }, () => Array(8).fill("")),
        ],
      },
      {
        range: "Storage!A2:C20",
        values: [
          ...storage,
          ...Array.from({ length: 19 - storage.length }, () =>
            Array(3).fill(""),
          ),
        ],
      },
      ...[
        ["A6", counts.user || 0],
        ["C6", counts.entry || 0],
        [
          "E6",
          stored.filter(
            (r: any[]) =>
              r[0] === "fitness" &&
              JSON.parse(r[3]).kind === "workout" &&
              !JSON.parse(r[3]).deleted_at,
          ).length,
        ],
        ["G6", counts.water || 0],
        ["A11", recent.length],
        ["C11", recent.filter((r) => Number(r[2]) >= 400).length],
        ["E11", pct(0.5)],
        ["G11", pct(0.95)],
        ["A19", "Last refreshed: " + new Date().toISOString() + " · UTC"],
      ].map(([cell, value]) => ({ range: "Admin!" + cell, values: [[value]] })),
    ];
    Sheets.Spreadsheets.Values.batchUpdate(
      { valueInputOption: "RAW", data: values.filter((v) => v.values.length) },
      id,
    );
    return { ready: true, samples: rows.length, accounts: counts.user || 0 };
  } finally {
    cache.remove("fitkin:admin:refreshing");
  }
}
