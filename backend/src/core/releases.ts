/** Only a published team release with a matching APK and checksum may require an update. */
export function releaseManifest(release: any) {
  if (!release || release.draft || release.prerelease) return null;
  const match = /^v(\d+\.\d+\.\d+)-team\.\d+$/.exec(release.tag_name || "");
  if (!match || !Array.isArray(release.assets)) return null;
  const version = match[1], name = `FitLens-${version}-team-arm64.apk`;
  const url = `https://github.com/neha-pd/caloriesTracker/releases/download/${release.tag_name}/${name}`;
  const apk = release.assets.find((a: any) => a.name === name && a.state === "uploaded" && a.size > 0 && a.browser_download_url === url);
  const checksum = release.assets.find((a: any) => a.name === name + ".sha256" && a.state === "uploaded" && a.size > 0);
  return apk && checksum ? { version, url, required: true } : null;
}
export function createReleaseLookup(fetcher: typeof fetch = fetch) {
  let cached: ReturnType<typeof releaseManifest> = null, checked = 0;
  let pending: Promise<ReturnType<typeof releaseManifest>> | null = null;
  return async () => {
    if (Date.now() - checked < 300_000) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher("https://api.github.com/repos/neha-pd/caloriesTracker/releases/latest", {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "FitLens-release-check" },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw Error("Release check unavailable");
        cached = releaseManifest(await response.json());
        checked = Date.now();
        return cached;
      } catch { checked = Date.now() - 240_000; return cached; }
      finally { pending = null; }
    })();
    return pending;
  };
}
