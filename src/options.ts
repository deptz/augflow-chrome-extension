import {
  augflowFetchJiraDefaultRepoSlug,
  augflowHealthCheck,
  augflowListProjects,
  augflowListRepos,
} from "./lib/augflowClient";
import { ensureOriginPermission } from "./lib/augflowPermissions";
import { validateAugflowBaseUrl } from "./lib/augflowUrl";
import {
  getDefaultRepo,
  loadSettings,
  saveSettings,
  withDefaultRepo,
} from "./lib/storage";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id}`);
  }
  return el;
}

function applyShortcutLabels(): void {
  const isMac =
    navigator.platform.toLowerCase().includes("mac") || /Mac|iPhone|iPad/.test(navigator.userAgent);
  ($("shortcutImport") as HTMLElement).textContent = isMac ? "⌘⇧Y" : "Ctrl+Shift+Y";
  ($("shortcutImportOptions") as HTMLElement).textContent = isMac ? "⌘⇧U" : "Ctrl+Shift+U";
}

function setStatus(ok: boolean, text: string): void {
  const box = $("status") as HTMLDivElement;
  box.textContent = text;
  box.classList.add("visible");
  box.classList.toggle("ok", ok);
  box.classList.toggle("err", !ok);
}

function projectPathValue(): string {
  const select = $("projectPathSelect") as HTMLSelectElement;
  if (select.style.display !== "none" && select.value) {
    return select.value.trim();
  }
  return ($("projectPath") as HTMLTextAreaElement).value.trim();
}

function mergedSettingsFromForm() {
  return loadSettings().then((settings) => ({
    ...settings,
    augflowBaseUrl:
      ($("augflowBaseUrl") as HTMLInputElement).value.trim() || settings.augflowBaseUrl,
    apiToken: ($("apiToken") as HTMLInputElement).value || settings.apiToken,
  }));
}

async function populateReposDropdown(projectPath: string): Promise<void> {
  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const hint = $("defaultRepoHint") as HTMLParagraphElement;

  if (!projectPath) {
    repoSelect.style.display = "none";
    hint.textContent = "Set a default project first, then Test connection.";
    return;
  }

  const settings = await mergedSettingsFromForm();
  const res = await augflowListRepos(settings, projectPath);
  repoSelect.innerHTML = "";

  if (!res.ok) {
    repoSelect.style.display = "none";
    hint.textContent = res.message;
    return;
  }

  if (res.data.repos.length === 0) {
    repoSelect.style.display = "none";
    hint.textContent = "No repositories configured for this project in Augflow.";
    return;
  }

  for (const slug of res.data.repos) {
    const opt = document.createElement("option");
    opt.value = slug;
    opt.textContent = slug;
    repoSelect.appendChild(opt);
  }

  let preferred = getDefaultRepo(settings, projectPath);
  if (!preferred || !res.data.repos.includes(preferred)) {
    const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
    if (jiraDefault && res.data.repos.includes(jiraDefault)) {
      preferred = jiraDefault;
    } else {
      preferred = res.data.repos[0] ?? "";
    }
  }
  if (preferred) {
    repoSelect.value = preferred;
  }

  repoSelect.style.display = "block";
  hint.textContent = "Default repository for this project (used on normal import and pre-selected in Shift+click dialog).";
}

async function populateProjectsDropdown(): Promise<void> {
  const settings = await mergedSettingsFromForm();
  const res = await augflowListProjects(settings);
  const select = $("projectPathSelect") as HTMLSelectElement;
  const textarea = $("projectPath") as HTMLTextAreaElement;
  if (!res.ok || res.data.length === 0) {
    select.style.display = "none";
    textarea.style.display = "block";
    return;
  }
  select.innerHTML = "";
  for (const p of res.data) {
    const opt = document.createElement("option");
    opt.value = p.path;
    opt.textContent = p.path;
    select.appendChild(opt);
  }
  const current = textarea.value.trim() || settings.projectPath;
  if (current) {
    select.value = current;
    if (!select.value) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = current;
      select.appendChild(opt);
      select.value = current;
    }
  }
  select.style.display = "block";
  textarea.style.display = "none";
  select.onchange = () => {
    textarea.value = select.value;
    void populateReposDropdown(select.value.trim());
  };
  await populateReposDropdown(select.value.trim() || current);
}

async function fillForm(): Promise<void> {
  const s = await loadSettings();
  ($("augflowBaseUrl") as HTMLInputElement).value = s.augflowBaseUrl;
  ($("projectPath") as HTMLTextAreaElement).value = s.projectPath;
  ($("apiToken") as HTMLInputElement).value = s.apiToken;
  ($("autoStartCard") as HTMLInputElement).checked = s.autoStartCard;
}

async function ensureUrlPermission(baseUrl: string): Promise<boolean> {
  const v = validateAugflowBaseUrl(baseUrl);
  if (!v.ok) {
    setStatus(false, v.error);
    return false;
  }
  const perm = await ensureOriginPermission(v.baseUrl);
  if (!perm.ok) {
    setStatus(false, perm.error);
    return false;
  }
  return true;
}

async function onSave(): Promise<void> {
  const augflowBaseUrl = ($("augflowBaseUrl") as HTMLInputElement).value.trim();
  const v = validateAugflowBaseUrl(augflowBaseUrl);
  if (!v.ok) {
    setStatus(false, v.error);
    return;
  }
  if (!(await ensureUrlPermission(v.baseUrl))) {
    return;
  }
  const projectPath = projectPathValue();
  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const repoSlug =
    repoSelect.style.display !== "none" && repoSelect.value
      ? repoSelect.value.trim()
      : "";
  const settings = await loadSettings();
  await saveSettings({
    augflowBaseUrl: v.baseUrl,
    projectPath,
    defaultRepoByProject: repoSlug
      ? withDefaultRepo(settings, projectPath, repoSlug)
      : settings.defaultRepoByProject,
    apiToken: ($("apiToken") as HTMLInputElement).value,
    autoStartCard: ($("autoStartCard") as HTMLInputElement).checked,
  });
  await fillForm();
  await populateProjectsDropdown();
  setStatus(true, "Saved.");
}

async function onTestConn(): Promise<void> {
  const augflowBaseUrl = ($("augflowBaseUrl") as HTMLInputElement).value.trim();
  const v = validateAugflowBaseUrl(augflowBaseUrl);
  if (!v.ok) {
    setStatus(false, v.error);
    return;
  }
  if (!(await ensureUrlPermission(v.baseUrl))) {
    return;
  }
  const settings = await loadSettings();
  const res = await augflowHealthCheck({
    ...settings,
    augflowBaseUrl: v.baseUrl,
    apiToken: ($("apiToken") as HTMLInputElement).value,
  });
  if (!res.ok) {
    setStatus(false, res.message);
    return;
  }
  await populateProjectsDropdown();
  setStatus(true, "Reached Augflow health endpoint OK.");
}

applyShortcutLabels();
void fillForm();

($("save") as HTMLButtonElement).addEventListener("click", () => {
  void onSave();
});

($("testConn") as HTMLButtonElement).addEventListener("click", () => {
  void onTestConn();
});
