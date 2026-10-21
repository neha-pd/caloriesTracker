const url = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL;
if (
  !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
    url || "",
  ) ||
  url.includes("YOUR_")
)
  throw Error("Set EXPO_PUBLIC_APPS_SCRIPT_URL to the deployed /exec URL.");
const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
const response = await r.json();
if (
  !r.ok ||
  response.status !== 200 ||
  response.data?.service !== "Fitkin" ||
  response.data?.protocol !== 1 ||
  !response.data?.ready ||
  !["2.7.0-sheets.2", "2.7.1-sheets.3"].includes(response.data?.revision)
)
  throw Error(
    "The Apps Script backend needs activation or the current Code.gs deployment. Finish setup before building a release APK.",
  );
console.log("Fitkin Apps Script endpoint is ready.");
if (response.data.revision === "2.7.0-sheets.2")
  console.warn(
    "Compatible previous backend: individual sync remains active until the owner deploys 2.7.1-sheets.3. Admin metrics and batch sync need that deployment.",
  );
