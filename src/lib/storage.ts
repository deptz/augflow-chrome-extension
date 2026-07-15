export type DefaultReposByProject = Record<string, string[]>;

export interface ExtensionSettings {
  augflowBaseUrl: string;
  /** Default project identifier (registry key or legacy absolute path). */
  projectPath: string;
  /** Per-project default repository slugs (repo keys from GET /api/config/repos). */
  defaultRepoByProject: DefaultReposByProject;
  /** Optional Bearer token when Augflow api.api_token is set. */
  apiToken: string;
  /** After successful quick import, call POST /api/cards/start */
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

/** Trim, drop empties, and dedupe while preserving order. */
function normalizeRepoSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const slug = typeof raw === "string" ? raw.trim() : "";
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function parseDefaultRepoByProject(raw: unknown): DefaultReposByProject {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: DefaultReposByProject = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = typeof key === "string" ? key.trim() : "";
    if (!trimmedKey) {
      continue;
    }
    if (typeof value === "string") {
      // Legacy single-slug shape.
      const slug = value.trim();
      if (slug) {
        out[trimmedKey] = [slug];
      }
    } else if (Array.isArray(value)) {
      const slugs = normalizeRepoSlugs(value.filter((v): v is string => typeof v === "string"));
      if (slugs.length > 0) {
        out[trimmedKey] = slugs;
      }
    }
  }
  return out;
}

export function getDefaultRepos(settings: ExtensionSettings, projectPath: string): string[] {
  const key = projectPath.trim();
  if (!key) {
    return [];
  }
  return settings.defaultRepoByProject[key] ?? [];
}

export function withDefaultRepos(
  settings: ExtensionSettings,
  projectPath: string,
  slugs: string[]
): DefaultReposByProject {
  const key = projectPath.trim();
  const normalized = normalizeRepoSlugs(slugs);
  if (!key || normalized.length === 0) {
    return { ...settings.defaultRepoByProject };
  }
  return { ...settings.defaultRepoByProject, [key]: normalized };
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
  const current = await loadSettings();
  await area().set({ ...current, ...partial });
}

/** Best-effort: seed defaults once. */
export async function ensureDefaultsOnInstall(): Promise<void> {
  const raw = await area().get(["augflowBaseUrl"]);
  if (raw.augflowBaseUrl == null) {
    await area().set({ augflowBaseUrl: DEFAULT_SETTINGS.augflowBaseUrl });
  }
}
