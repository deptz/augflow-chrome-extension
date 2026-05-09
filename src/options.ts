import { validateAugflowBaseUrl } from "./lib/augflowUrl";
import { loadSettings, saveSettings } from "./lib/storage";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id}`);
  }
  return el;
}

function setStatus(ok: boolean, text: string): void {
  const box = $("status") as HTMLDivElement;
  box.textContent = text;
  box.classList.add("visible");
  box.classList.toggle("ok", ok);
  box.classList.toggle("err", !ok);
}

async function fillForm(): Promise<void> {
  const s = await loadSettings();
  ($("augflowBaseUrl") as HTMLInputElement).value = s.augflowBaseUrl;
  ($("projectPath") as HTMLTextAreaElement).value = s.projectPath;
  ($("apiToken") as HTMLInputElement).value = s.apiToken;
  ($("autoStartCard") as HTMLInputElement).checked = s.autoStartCard;
}

async function onSave(): Promise<void> {
  const augflowBaseUrl = ($("augflowBaseUrl") as HTMLInputElement).value.trim();
  const v = validateAugflowBaseUrl(augflowBaseUrl);
  if (!v.ok) {
    setStatus(false, v.error);
    return;
  }
  await saveSettings({
    augflowBaseUrl: v.baseUrl,
    projectPath: ($("projectPath") as HTMLTextAreaElement).value.trim(),
    apiToken: ($("apiToken") as HTMLInputElement).value,
    autoStartCard: ($("autoStartCard") as HTMLInputElement).checked,
  });
  await fillForm();
  setStatus(true, "Saved.");
}

async function onTestConn(): Promise<void> {
  const augflowBaseUrl = ($("augflowBaseUrl") as HTMLInputElement).value.trim();
  const v = validateAugflowBaseUrl(augflowBaseUrl);
  if (!v.ok) {
    setStatus(false, v.error);
    return;
  }
  try {
    const res = await fetch(`${v.baseUrl}/health`, { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      setStatus(false, `Health check failed (${res.status}): ${text.slice(0, 200)}`);
      return;
    }
    setStatus(true, "Reached Augflow health endpoint OK.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(false, `Cannot reach Augflow: ${msg}`);
  }
}

void fillForm();

($("save") as HTMLButtonElement).addEventListener("click", () => {
  void onSave();
});

($("testConn") as HTMLButtonElement).addEventListener("click", () => {
  void onTestConn();
});
