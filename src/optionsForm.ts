/** Shown before Test connection loads the project dropdown. */
export const HINT_PROJECT_LOAD_FIRST =
  "Project identifier from Augflow's project switcher. Load projects via Test connection first.";

/** Shown after projects load successfully. */
export const HINT_PROJECT_SUCCESS =
  "Project identifier from Augflow's project switcher (registry key, not necessarily a filesystem path).";

export const HINT_REPO_LOAD_FIRST =
  "Repository slug for the selected default project. Load projects via Test connection first.";

export const HINT_REPO_NEED_PROJECT = "Set a default project first, then Test connection.";

export const HINT_REPO_SUCCESS =
  "Default repositories for this project (used on quick import (Shift+click) and pre-checked in the import dialog).";

export const HINT_REPO_NONE = "No repositories configured for this project in Augflow.";

export function formatSavedProjectHint(projectPath: string): string {
  const path = projectPath.trim();
  if (!path) {
    return HINT_PROJECT_LOAD_FIRST;
  }
  return `Saved default project: ${path}. Test connection to refresh the list.`;
}

export function formatSavedRepoHint(projectPath: string, slugs: string[]): string {
  if (!projectPath.trim()) {
    return HINT_REPO_LOAD_FIRST;
  }
  const normalized = slugs.map((s) => s.trim()).filter((s) => s !== "");
  if (normalized.length === 0) {
    return HINT_REPO_LOAD_FIRST;
  }
  const noun = normalized.length > 1 ? "repositories" : "repository";
  return `Saved default ${noun}: ${normalized.join(", ")}. Test connection to refresh the list.`;
}

export function isSelectDisplayed(select: HTMLElement): boolean {
  return select.style.display !== "none";
}

/** Prefer visible project dropdown; otherwise last saved hidden value. */
export function resolveProjectPathValue(
  selectDisplayed: boolean,
  selectValue: string,
  hiddenValue: string
): string {
  if (selectDisplayed && selectValue.trim()) {
    return selectValue.trim();
  }
  return hiddenValue.trim();
}

/** Repo slugs are only persisted when the repo checkbox list is displayed. */
export function resolveRepoSlugsFromForm(displayed: boolean, checkedValues: string[]): string[] {
  if (!displayed) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of checkedValues) {
    const slug = raw.trim();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export type ProjectsListResult =
  | { ok: true; projects: string[] }
  | { ok: false; message: string };

export type ProjectsPopulatePlan = {
  showSelect: boolean;
  hint: string;
  options: string[];
  selected: string;
};

export function planProjectsPopulate(
  result: ProjectsListResult,
  storedPath: string
): ProjectsPopulatePlan {
  const stored = storedPath.trim();

  if (!result.ok) {
    return {
      showSelect: false,
      hint: result.message,
      options: [],
      selected: stored,
    };
  }

  if (result.projects.length === 0) {
    return {
      showSelect: false,
      hint:
        stored.length > 0
          ? `No projects returned from Augflow. Saved default: ${stored}.`
          : "No projects registered in Augflow yet.",
      options: [],
      selected: stored,
    };
  }

  const options = [...result.projects];
  const selected = stored;
  if (selected && !options.includes(selected)) {
    options.push(selected);
  }

  return {
    showSelect: true,
    hint: HINT_PROJECT_SUCCESS,
    options,
    selected,
  };
}

export type ReposListResult =
  | { ok: true; repos: string[] }
  | { ok: false; message: string };

export type ReposPopulatePlan = {
  showSelect: boolean;
  hint: string;
  repos: string[];
};

export function planReposPopulate(
  projectPath: string,
  result: ReposListResult
): ReposPopulatePlan {
  if (!projectPath.trim()) {
    return { showSelect: false, hint: HINT_REPO_NEED_PROJECT, repos: [] };
  }
  if (!result.ok) {
    return { showSelect: false, hint: result.message, repos: [] };
  }
  if (result.repos.length === 0) {
    return { showSelect: false, hint: HINT_REPO_NONE, repos: [] };
  }
  return { showSelect: true, hint: HINT_REPO_SUCCESS, repos: result.repos };
}

export function applySelectPlan(
  select: HTMLSelectElement,
  plan: { showSelect: boolean; options: string[]; selected: string }
): void {
  select.innerHTML = "";
  if (!plan.showSelect) {
    select.style.display = "none";
    return;
  }
  for (const value of plan.options) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  if (plan.selected) {
    select.value = plan.selected;
  }
  select.style.display = "block";
}
