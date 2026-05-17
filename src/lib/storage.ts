export type DefaultRepoByProject = Record<string, string>;

export interface ExtensionSettings {
  augflowBaseUrl: string;
  /** Default project identifier (registry key or legacy absolute path). */
  projectPath: string;
  /** Per-project default repository slug (repo key from GET /api/config/repos). */
  defaultRepoByProject: DefaultRepoByProject;
  /** Optional Bearer token when Augflow api.api_token is set. */
  apiToken: string;
  /** After successful import on normal click, call POST /api/cards/start */
  autoStartCard: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  augflowBaseUrl: "http://localhost:4400",
  projectPath: "",
  defaultRepoByProject: {},
  apiToken: "",
  autoStartCard: false,
};

type StorageArea = typeof chrome.storage.sync;

function area(): StorageArea {
  return chrome.storage.sync;
}

function parseDefaultRepoByProject(raw: unknown): DefaultRepoByProject {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: DefaultRepoByProject = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === "string" && typeof value === "string" && key.trim() && value.trim()) {
      out[key.trim()] = value.trim();
    }
  }
  return out;
}

export function getDefaultRepo(settings: ExtensionSettings, projectPath: string): string {
  const key = projectPath.trim();
  if (!key) {
    return "";
  }
  return settings.defaultRepoByProject[key]?.trim() ?? "";
}

export function withDefaultRepo(
  settings: ExtensionSettings,
  projectPath: string,
  repoSlug: string
): DefaultRepoByProject {
  const key = projectPath.trim();
  const slug = repoSlug.trim();
  if (!key || !slug) {
    return { ...settings.defaultRepoByProject };
  }
  return { ...settings.defaultRepoByProject, [key]: slug };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await area().get([
    "augflowBaseUrl",
    "projectPath",
    "defaultRepoByProject",
    "apiToken",
    "autoStartCard",
  ]);
  return {
    augflowBaseUrl:
      typeof raw.augflowBaseUrl === "string" && raw.augflowBaseUrl
        ? raw.augflowBaseUrl
        : DEFAULT_SETTINGS.augflowBaseUrl,
    projectPath: typeof raw.projectPath === "string" ? raw.projectPath : "",
    defaultRepoByProject: parseDefaultRepoByProject(raw.defaultRepoByProject),
    apiToken: typeof raw.apiToken === "string" ? raw.apiToken : "",
    autoStartCard: Boolean(raw.autoStartCard),
  };
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  await area().set(partial);
}

/** Best-effort: seed defaults once. */
export async function ensureDefaultsOnInstall(): Promise<void> {
  const raw = await area().get(["augflowBaseUrl"]);
  if (raw.augflowBaseUrl == null) {
    await area().set({ augflowBaseUrl: DEFAULT_SETTINGS.augflowBaseUrl });
  }
}
