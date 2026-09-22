/** Published releases retain a legacy-named APK so 2.5 clients can update safely. */
const owner = "neha-pd";
const legacyRepo = "caloriesTracker";
const allowedRepos = [legacyRepo.toLowerCase(), "fitkin"];
const tagPattern = /^v(\d+\.\d+\.\d+)-team\.\d+$/;
export function trustedAsset(url: string, tag: string, name: string) {
  try {
    const u = new URL(url), parts = u.pathname.split("/");
    return u.protocol === "https:" && u.hostname === "github.com" && !u.port && !u.username && !u.password && !u.search && !u.hash &&
      parts.length === 7 && parts[1] === owner && allowedRepos.includes(parts[2].toLowerCase()) &&
      parts[3] === "releases" && parts[4] === "download" && parts[5] === tag && parts[6] === name;
  } catch { return false; }
}
export function releaseManifest(release: any) {
  if (!release || release.draft || release.prerelease) return null;
  const match = tagPattern.exec(release.tag_name || "");
  if (!match || !Array.isArray(release.assets)) return null;
  const version = match[1], name = `FitLens-${version}-team-arm64.apk`, modern = `Fitkin-${version}-team-arm64.apk`;
  const has = (name: string) => release.assets.find((a: any) => a.name === name && a.state === "uploaded" && a.size > 0 && trustedAsset(a.browser_download_url, release.tag_name, name));
  if (!has(name) || !has(name+".sha256")) return null;
  const branded = has(modern) && has(modern+".sha256") ? has(modern).browser_download_url : undefined;
  // Old installed clients only accept this exact repository path and filename.
  // GitHub redirects it after a repository rename; do not reuse the old repository name.
  const url = `https://github.com/${owner}/${legacyRepo}/releases/download/${release.tag_name}/${name}`;
  return {version,url,required:true,...(branded ? {brandedUrl:branded} : {})};
}
/** Avoid anonymous GitHub API quotas shared by free hosting IPs. */
export async function releaseFromPublicPage(fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://github.com/${owner}/${legacyRepo}/releases/latest`, {method:"HEAD",signal:AbortSignal.timeout(3500)});
  if (!response.ok) return null;
  const u = new URL(response.url), parts = u.pathname.split("/");
  if (u.protocol!=="https:" || u.hostname!=="github.com" || parts.length!==6 || parts[1]!==owner || !allowedRepos.includes(parts[2].toLowerCase()) || parts[3]!=="releases" || parts[4]!=="tag") return null;
  const match=tagPattern.exec(parts[5]); if(!match)return null;
  const name=`FitLens-${match[1]}-team-arm64.apk`, modern=`Fitkin-${match[1]}-team-arm64.apk`, tag=parts[5];
  const asset=async(name:string)=>{
    const url=`https://github.com/${owner}/${parts[2]}/releases/download/${tag}/${name}`;
    const r=await fetcher(url,{method:"HEAD",signal:AbortSignal.timeout(3500)});
    return {name,state:"uploaded",size:r.ok?Number(r.headers.get("content-length")):0,browser_download_url:url};
  };
  const names=[name,name+".sha256",modern,modern+".sha256"];
  const assets=await Promise.all(names.map(n=>asset(n).catch(()=>({name:n,size:0}))));
  return releaseManifest({tag_name:tag,draft:false,prerelease:false,assets});
}
export function createReleaseLookup(fetcher: typeof fetch = fetch) {
  let cached: ReturnType<typeof releaseManifest> = null, checked = 0;
  let pending: Promise<ReturnType<typeof releaseManifest>> | null = null;
  return async () => {
    if (Date.now() - checked < 300_000) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(`https://api.github.com/repos/${owner}/${legacyRepo}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "Fitkin-release-check" },
          signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) throw Error("Release check unavailable");
        cached = releaseManifest(await response.json());
        checked = Date.now();
        return cached;
      } catch {
        try {const fallback=await releaseFromPublicPage(fetcher);if(fallback){cached=fallback;checked=Date.now();return cached;}}catch{}
        checked=Date.now()-240_000;return cached;
      } finally { pending=null; }
    })();
    return pending;
  };
}
