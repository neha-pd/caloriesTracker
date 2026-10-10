import type { Profile } from "./domain";
const path = "/.netlify/functions/train-push";
function token(uid: string) {
  const key = "fitkin:push:token:" + uid;
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}
async function request(body: any) {
  const r = await fetch(path, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw Error(
      d.error ||
        "Push reminders need a Netlify deployment with Functions enabled. You can also export calendar reminders.",
    );
  }
  return r.json();
}
async function worker() {
  if (!("serviceWorker" in navigator))
    throw Error(
      "This browser does not support app notifications. Export calendar reminders instead.",
    );
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg)
    throw Error("Install or reload the app once before enabling reminders.");
  return reg;
}
export async function enableReminders(p: Profile, uid: string) {
  if (!("Notification" in window) || !("PushManager" in window))
    throw Error(
      "This browser needs an installed Home Screen app for push, or does not support it. Use calendar reminders instead.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Notifications were not allowed. Change your browser settings or use calendar reminders.",
    );
  const cfg = await fetch(path, { signal: AbortSignal.timeout(10000) }).then(
    async (r) => {
      if (!r.ok || !r.headers.get("content-type")?.includes("application/json"))
        throw Error(
          "Push reminders require the Netlify Functions deployment. Calendar reminders work on any host.",
        );
      return r.json();
    },
  );
  const reg = await worker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(
        atob(cfg.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      ),
    });
  const previous = localStorage.getItem("fitkin:push:owner");
  if (previous && previous !== uid) await disableReminders(previous);
  const result = await request({
    action: "subscribe",
    token: token(uid),
    subscription: sub.toJSON(),
    days: p.days,
    time: p.time,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tone: p.tone,
  });
  localStorage.setItem("fitkin:push:id:" + uid, result.id);
  localStorage.setItem("fitkin:push:owner", uid);
  return "Reminders enabled. Delivery may be delayed by your device or network; quiet hours are 22:00–08:00.";
}
export async function disableReminders(uid: string) {
  const id = localStorage.getItem("fitkin:push:id:" + uid);
  if (id) await request({ action: "unsubscribe", token: token(uid), id });
  localStorage.removeItem("fitkin:push:id:" + uid);
  if (localStorage.getItem("fitkin:push:owner") === uid)
    localStorage.removeItem("fitkin:push:owner");
}
export async function syncCompletion(uid: string, date: string) {
  if (localStorage.getItem("fitkin:push:owner") === uid)
    await request({
      action: "complete",
      token: token(uid),
      id: localStorage.getItem("fitkin:push:id:" + uid),
      date,
    });
}
export async function restAlert() {
  if ("Notification" in window && Notification.permission === "granted") {
    const reg = await worker();
    await reg.showNotification("Rest complete", {
      body: "Ready for your next set? Take longer if you need it.",
      tag: "fitkin-rest",
      data: { url: "/train" },
    });
  }
}
export async function installApp() {
  const event = (window as any).fitkinInstallPrompt;
  if (event) {
    await event.prompt();
    const result = await event.userChoice;
    (window as any).fitkinInstallPrompt = null;
    return result.outcome === "accepted"
      ? "Fitkin added to your apps."
      : "You can install later from your browser menu.";
  }
  return "Use your browser menu → Install app. On iPhone: Safari → Share → Add to Home Screen. Open the installed app to enable notifications.";
}
export async function downloadFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pauseReminders(uid: string) {
  try {
    await disableReminders(uid);
  } catch {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
    localStorage.removeItem("fitkin:push:id:" + uid);
    localStorage.removeItem("fitkin:push:owner");
  }
}
