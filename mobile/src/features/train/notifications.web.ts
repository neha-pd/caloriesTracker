import type { Profile } from "./domain";
export async function enableReminders(_profile: Profile, _uid: string) {
  throw new Error(
    "Export your workout calendar and choose alerts in Calendar. Background push is not enabled in this PWA.",
  );
}
export async function disableReminders(_uid: string) {}
export const pauseReminders = disableReminders;
export async function restAlert() {
  /* The visible rest timer is the web alert. */
}
export async function syncCompletion(_uid: string, _date: string) {}
export async function installApp() {
  return "In Safari, tap Share → Add to Home Screen. Open the Fitkin icon to start.";
}
export async function downloadFile(name: string, text: string, type: string) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Fitkin" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError")
        throw new Error("Sharing cancelled. Tap export when you’re ready to save the file.");
    }
  }
  const url = URL.createObjectURL(file),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
