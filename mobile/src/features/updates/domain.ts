export type AppRelease = { version: string; url: string; required: true; brandedUrl?: string };
export function validRelease(value: any): value is AppRelease {
  if (!value || value.required !== true || typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version)) return false;
  const version=value.version.replaceAll(".","\\.");
  return typeof value.url === "string" && new RegExp(`^https://github\\.com/neha-pd/(?:caloriesTracker|[Ff]itkin)/releases/download/v${version}-team\\.\\d+/(?:FitLens|Fitkin)-${version}-team-arm64\\.apk$`).test(value.url);
}
export function preferredRelease(value: unknown): AppRelease | null {
  if (!validRelease(value)) return null;
  const modern={...value,url:value.brandedUrl};
  return validRelease(modern) ? modern : value;
}
export function needsUpdate(installed: string, release: AppRelease) {
  if (!/^\d+\.\d+\.\d+$/.test(installed) || !validRelease(release)) return false;
  const current=installed.split(".").map(Number),next=release.version.split(".").map(Number);
  for(let i=0;i<3;i++){if(next[i]!==current[i])return next[i]>current[i];}
  return false;
}
