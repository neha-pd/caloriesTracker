declare const __FITKIN_DASHBOARD_HTML__: string;
import { owner } from "./admin";
import { refreshDashboard, routeLabel } from "./observability";
declare const HtmlService: any,
  PropertiesService: any,
  Sheets: any,
  ScriptApp: any;

// The HTML contains no private data. Every data call rechecks the active
// Google identity; execute-as-owner alone is never authorization.
export function dashboardPage() {
  return HtmlService.createHtmlOutput(__FITKIN_DASHBOARD_HTML__)
    .setTitle("Fitkin · Admin")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
export function openDashboard() {
  owner();
  const base = ScriptApp.getService().getUrl();
  if (!base) throw Error("Deploy this project as a web app first.");
  const url = base + "?view=admin";
  console.log(
    "Open your private Fitkin dashboard while signed in as the configured owner: " +
      url,
  );
  return url;
}
const n = (v: any) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
const percentile = (values: number[], q: number) =>
  values.length
    ? Math.round(
        [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1],
      )
    : null;
export function summarizeRequests(raw: any[][], now: number, days: number) {
  const start = now - days * 86400000;
  const rows = raw
    .filter(
      (r) =>
        Date.parse(r[0]) >= start && Date.parse(r[0]) <= now && n(r[2]) >= 100,
    )
    .map((r) => ({
      at: String(r[0]),
      route: /^\/api\/v2\/(entries|water|fitness|foods\/custom)\/:id$/.test(
        String(r[1]),
      )
        ? String(r[1])
        : routeLabel(r[1]),
      status: n(r[2]),
      ms: n(r[3]),
      lock: n(r[4]),
      read: n(r[5]),
      write: n(r[6]),
      operations: n(r[7]),
      rejected: n(r[8]),
      actor: String(r[9] || ""),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const average = (key: "lock" | "read" | "write" | "ms") =>
    rows.length
      ? Math.round(rows.reduce((s, r) => s + r[key], 0) / rows.length)
      : null;
  const byDay = new Map<string, typeof rows>(),
    byRoute = new Map<string, typeof rows>();
  for (const row of rows) {
    const date = row.at.slice(0, 10);
    byDay.set(date, [...(byDay.get(date) || []), row]);
    byRoute.set(row.route, [...(byRoute.get(row.route) || []), row]);
  }
  return {
    requests: rows.length,
    errors: rows.filter((r) => r.status >= 400).length,
    activeAccounts: new Set(rows.map((r) => r.actor).filter(Boolean)).size,
    operations: rows.reduce((s, r) => s + r.operations, 0),
    rejected: rows.reduce((s, r) => s + r.rejected, 0),
    median: percentile(
      rows.map((r) => r.ms),
      0.5,
    ),
    p95: percentile(
      rows.map((r) => r.ms),
      0.95,
    ),
    timing: {
      total: average("ms"),
      lock: average("lock"),
      read: average("read"),
      write: average("write"),
    },
    daily: [...byDay].map(([date, rs]) => ({
      date,
      requests: rs.length,
      errors: rs.filter((r) => r.status >= 400).length,
      median: percentile(
        rs.map((r) => r.ms),
        0.5,
      ),
      p95: percentile(
        rs.map((r) => r.ms),
        0.95,
      ),
    })),
    routes: [...byRoute]
      .map(([route, rs]) => ({
        route,
        requests: rs.length,
        errors: rs.filter((r) => r.status >= 400).length,
        p95: percentile(
          rs.map((r) => r.ms),
          0.95,
        ),
      }))
      .sort((a, b) => b.requests - a.requests),
    recent: rows
      .slice(-20)
      .reverse()
      .map(({ actor, ...row }) => row),
  };
}
export function dashboardData(input?: { days?: number; refresh?: boolean }) {
  owner(); // Must happen before properties, refresh or any data access.
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("ADMIN_METRICS") !== "on") return { configured: false };
  const days = [1, 7, 14].includes(input?.days || 0) ? input!.days! : 7;
  const refresh = input?.refresh === true ? refreshDashboard() : null;
  const id = props.getProperty("SPREADSHEET_ID");
  const result = Sheets.Spreadsheets.Values.batchGet(id, {
    ranges: [
      "'API Requests'!A2:J5001",
      "Admin!A6:H6",
      "Admin!A19",
      "Storage!A2:C20",
    ],
  });
  const values = (i: number) => result.valueRanges?.[i]?.values || [];
  const counts = values(1)[0] || [],
    refreshed =
      String(values(2)[0]?.[0] || "").match(/\d{4}-\d\d-\d\dT[\d:.]+Z/)?.[0] ||
      null;
  return {
    configured: true,
    ready: props.getProperty("MIGRATION_STATUS") === "ready",
    days,
    generatedAt: new Date().toISOString(),
    refreshedAt: refreshed,
    refreshBusy: refresh?.busy === true,
    sheetUrl:
      "https://docs.google.com/spreadsheets/d/" +
      encodeURIComponent(id) +
      "/edit",
    counts: {
      accounts: n(counts[0]),
      food: n(counts[2]),
      workouts: n(counts[4]),
      water: n(counts[6]),
    },
    storage: values(3)
      .filter((r: any[]) => r[0])
      .map((r: any[]) => ({
        kind: String(r[0]),
        count: n(r[1]),
        purpose: String(r[2] || ""),
      })),
    ...summarizeRequests(values(0), Date.now(), days),
  };
}
