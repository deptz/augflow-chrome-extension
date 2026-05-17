import {
  augflowFetchJiraDefaultRepoSlug,
  augflowHealthCheck,
  augflowListProjects,
  augflowListRepos,
} from "./lib/augflowClient";
import { ensureOriginPermission } from "./lib/augflowPermissions";
import { originPermissionPattern, validateAugflowBaseUrl } from "./lib/augflowUrl";
import {
  applySelectPlan,
  formatSavedProjectHint,
  formatSavedRepoHint,
  HINT_REPO_LOAD_FIRST,
  isSelectDisplayed,
  planProjectsPopulate,
  planReposPopulate,
  resolveProjectPathValue,
  resolveRepoSlugFromForm,
} from "./optionsForm";
import type { ExtensionSettings } from "./lib/storage";
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
  const hidden = $("projectPath") as HTMLInputElement;
  return resolveProjectPathValue(isSelectDisplayed(select), select.value, hidden.value);
}

function mergedSettingsFromForm() {
  return loadSettings().then((settings) => ({
    ...settings,
    augflowBaseUrl:
      ($("augflowBaseUrl") as HTMLInputElement).value.trim() || settings.augflowBaseUrl,
    apiToken: ($("apiToken") as HTMLInputElement).value || settings.apiToken,
  }));
}

function updateSavedHints(settings: ExtensionSettings): void {
  const projectSelect = $("projectPathSelect") as HTMLSelectElement;
  const projectHint = $("projectPathHint") as HTMLParagraphElement;
  if (!isSelectDisplayed(projectSelect)) {
    projectHint.textContent = formatSavedProjectHint(settings.projectPath);
  }

  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const repoHint = $("defaultRepoHint") as HTMLParagraphElement;
  if (!isSelectDisplayed(repoSelect)) {
    repoHint.textContent = formatSavedRepoHint(
      settings.projectPath,
      getDefaultRepo(settings, settings.projectPath)
    );
  }
}

function repoSelectReset(): void {
  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const hint = $("defaultRepoHint") as HTMLParagraphElement;
  repoSelect.innerHTML = "";
  repoSelect.style.display = "none";
  hint.textContent = HINT_REPO_LOAD_FIRST;
}

async function populateReposDropdown(projectPath: string): Promise<void> {
  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const hint = $("defaultRepoHint") as HTMLParagraphElement;
  const settings = await mergedSettingsFromForm();

  if (!projectPath.trim()) {
    const plan = planReposPopulate("", { ok: true, repos: [] });
    repoSelect.style.display = "none";
    repoSelect.innerHTML = "";
    hint.textContent = plan.hint;
    return;
  }

  const res = await augflowListRepos(settings, projectPath);
  const plan = planReposPopulate(
    projectPath,
    res.ok ? { ok: true, repos: res.data.repos } : { ok: false, message: res.message }
  );

  repoSelect.innerHTML = "";
  if (!plan.showSelect) {
    repoSelect.style.display = "none";
    hint.textContent = plan.hint;
    return;
  }

  for (const slug of plan.repos) {
    const opt = document.createElement("option");
    opt.value = slug;
    opt.textContent = slug;
    repoSelect.appendChild(opt);
  }

  let preferred = getDefaultRepo(settings, projectPath);
  if (!preferred || !plan.repos.includes(preferred)) {
    const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
    if (jiraDefault && plan.repos.includes(jiraDefault)) {
      preferred = jiraDefault;
    } else {
      preferred = plan.repos[0] ?? "";
    }
  }
  if (preferred) {
    repoSelect.value = preferred;
  }

  repoSelect.style.display = "block";
  hint.textContent = plan.hint;
}

async function populateProjectsDropdown(): Promise<void> {
  const settings = await mergedSettingsFromForm();
  const res = await augflowListProjects(settings);
  const select = $("projectPathSelect") as HTMLSelectElement;
  const hidden = $("projectPath") as HTMLInputElement;
  const hint = $("projectPathHint") as HTMLParagraphElement;
  const stored = hidden.value.trim() || settings.projectPath;

  const plan = planProjectsPopulate(
    res.ok ? { ok: true, projects: res.data.map((p) => p.path) } : { ok: false, message: res.message },
    stored
  );

  hint.textContent = plan.hint;
  applySelectPlan(select, plan);
  hidden.value = plan.selected;

  if (plan.showSelect) {
    select.onchange = () => {
      hidden.value = select.value;
      void populateReposDropdown(select.value.trim());
    };
    await populateReposDropdown(select.value.trim() || plan.selected);
  } else {
    repoSelectReset();
    updateSavedHints(await loadSettings());
  }
}

async function fillForm(): Promise<void> {
  const s = await loadSettings();
  ($("augflowBaseUrl") as HTMLInputElement).value = s.augflowBaseUrl;
  ($("projectPath") as HTMLInputElement).value = s.projectPath;
  ($("apiToken") as HTMLInputElement).value = s.apiToken;
  ($("autoStartCard") as HTMLInputElement).checked = s.autoStartCard;

  const projectSelect = $("projectPathSelect") as HTMLSelectElement;
  projectSelect.innerHTML = "";
  projectSelect.style.display = "none";
  repoSelectReset();
  updateSavedHints(s);
}

async function persistSettingsFromForm(): Promise<ExtensionSettings> {
  const augflowBaseUrl = ($("augflowBaseUrl") as HTMLInputElement).value.trim();
  const v = validateAugflowBaseUrl(augflowBaseUrl);
  if (!v.ok) {
    throw new Error(v.error);
  }

  const settings = await loadSettings();
  const projectPath = projectPathValue();
  const repoSelect = $("defaultRepoSlug") as HTMLSelectElement;
  const repoSlug = resolveRepoSlugFromForm(isSelectDisplayed(repoSelect), repoSelect.value);

  const next: ExtensionSettings = {
    augflowBaseUrl: v.baseUrl,
    projectPath,
    defaultRepoByProject: repoSlug
      ? withDefaultRepo(settings, projectPath, repoSlug)
      : settings.defaultRepoByProject,
    apiToken: ($("apiToken") as HTMLInputElement).value,
    autoStartCard: ($("autoStartCard") as HTMLInputElement).checked,
  };

  await saveSettings(next);
  return next;
}

async function tryRestoreDropdownsFromStorage(): Promise<void> {
  const s = await loadSettings();
  const v = validateAugflowBaseUrl(s.augflowBaseUrl);
  if (!v.ok || !s.projectPath.trim()) {
    return;
  }

  try {
    const has = await chrome.permissions.contains({
      origins: [originPermissionPattern(v.baseUrl)],
    });
    if (!has) {
      return;
    }
    await populateProjectsDropdown();
  } catch {
    /* Best-effort restore; saved hints still show persisted values. */
  }
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

  try {
    await persistSettingsFromForm();
  } catch (e) {
    setStatus(false, e instanceof Error ? e.message : String(e));
    return;
  }

  await fillForm();
  await tryRestoreDropdownsFromStorage();
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

  try {
    await persistSettingsFromForm();
    setStatus(true, "Connected and saved settings.");
  } catch (e) {
    setStatus(false, e instanceof Error ? e.message : String(e));
  }
}

async function initializeOptionsPage(): Promise<void> {
  await fillForm();
  await tryRestoreDropdownsFromStorage();
}

applyShortcutLabels();
void initializeOptionsPage();

($("save") as HTMLButtonElement).addEventListener("click", () => {
  void onSave();
});

($("testConn") as HTMLButtonElement).addEventListener("click", () => {
  void onTestConn();
});
