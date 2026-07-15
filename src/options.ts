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
  resolveRepoSlugsFromForm,
} from "./optionsForm";
import type { ExtensionSettings } from "./lib/storage";
import {
  getDefaultRepos,
  loadSettings,
  saveSettings,
  withDefaultRepos,
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

function checkedRepoSlugsInContainer(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked")
  ).map((input) => input.value);
}

function renderRepoCheckboxes(container: HTMLElement, slugs: string[], checked: string[]): void {
  container.innerHTML = "";
  for (const slug of slugs) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = slug;
    checkbox.checked = checked.includes(slug);
    label.append(checkbox, document.createTextNode(` ${slug}`));
    container.appendChild(label);
  }
}

function updateSavedHints(settings: ExtensionSettings): void {
  const projectSelect = $("projectPathSelect") as HTMLSelectElement;
  const projectHint = $("projectPathHint") as HTMLParagraphElement;
  if (!isSelectDisplayed(projectSelect)) {
    projectHint.textContent = formatSavedProjectHint(settings.projectPath);
  }

  const repoContainer = $("defaultRepoSlugs") as HTMLDivElement;
  const repoHint = $("defaultRepoHint") as HTMLParagraphElement;
  if (!isSelectDisplayed(repoContainer)) {
    repoHint.textContent = formatSavedRepoHint(
      settings.projectPath,
      getDefaultRepos(settings, settings.projectPath)
    );
  }
}

function repoCheckboxesReset(): void {
  const repoContainer = $("defaultRepoSlugs") as HTMLDivElement;
  const hint = $("defaultRepoHint") as HTMLParagraphElement;
  repoContainer.innerHTML = "";
  repoContainer.style.display = "none";
  hint.textContent = HINT_REPO_LOAD_FIRST;
}

async function populateReposCheckboxes(projectPath: string): Promise<void> {
  const repoContainer = $("defaultRepoSlugs") as HTMLDivElement;
  const hint = $("defaultRepoHint") as HTMLParagraphElement;
  const settings = await mergedSettingsFromForm();

  if (!projectPath.trim()) {
    const plan = planReposPopulate("", { ok: true, repos: [] });
    repoContainer.style.display = "none";
    repoContainer.innerHTML = "";
    hint.textContent = plan.hint;
    return;
  }

  const res = await augflowListRepos(settings, projectPath);
  const plan = planReposPopulate(
    projectPath,
    res.ok ? { ok: true, repos: res.data.repos } : { ok: false, message: res.message }
  );

  repoContainer.innerHTML = "";
  if (!plan.showSelect) {
    repoContainer.style.display = "none";
    hint.textContent = plan.hint;
    return;
  }

  let preferred = getDefaultRepos(settings, projectPath).filter((slug) =>
    plan.repos.includes(slug)
  );
  if (preferred.length === 0) {
    const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
    if (jiraDefault && plan.repos.includes(jiraDefault)) {
      preferred = [jiraDefault];
    } else {
      preferred = plan.repos[0] ? [plan.repos[0]] : [];
    }
  }

  renderRepoCheckboxes(repoContainer, plan.repos, preferred);

  repoContainer.style.display = "block";
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
      void populateReposCheckboxes(select.value.trim());
    };
    await populateReposCheckboxes(select.value.trim() || plan.selected);
  } else {
    repoCheckboxesReset();
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
  repoCheckboxesReset();
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
  const repoContainer = $("defaultRepoSlugs") as HTMLDivElement;
  const repoSlugs = resolveRepoSlugsFromForm(
    isSelectDisplayed(repoContainer),
    checkedRepoSlugsInContainer(repoContainer)
  );

  const next: ExtensionSettings = {
    augflowBaseUrl: v.baseUrl,
    projectPath,
    defaultRepoByProject:
      repoSlugs.length > 0
        ? withDefaultRepos(settings, projectPath, repoSlugs)
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
