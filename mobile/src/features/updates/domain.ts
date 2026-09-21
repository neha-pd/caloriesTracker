export type AppRelease = { version: string; url: string; required: true };
export function validRelease(value: any): value is AppRelease {
  if (!value || value.required !== true || typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version)) return false;
  return typeof value.url === "string" && new RegExp(`^https://github\\.com/neha-pd/caloriesTracker/releases/download/v${value.version.replaceAll(".", "\\.")}-team\\.\\d+/FitLens-${value.version.replaceAll(".", "\\.")}-team-arm64\\.apk$`).test(value.url);
}
export function needsUpdate(installed: string, release: AppRelease) {
  if (!/^\d+\.\d+\.\d+$/.test(installed) || !validRelease(release)) return false;
  const current = installed.split(".").map(Number), next = release.version.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (next[i] !== current[i]) return next[i] > current[i];
  }
  return false;
}
