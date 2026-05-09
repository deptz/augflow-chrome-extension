export interface ExtensionSettings {
  augflowBaseUrl: string;
  /** Absolute path — must match a project registered with Augflow. */
  projectPath: string;
  /** Optional Bearer token when Augflow api.api_token is set. */
  apiToken: string;
  /** After successful import, call POST /api/cards/start */
  autoStartCard: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  augflowBaseUrl: "http://localhost:4400",
  projectPath: "",
  apiToken: "",
  autoStartCard: false,
};

type StorageArea = typeof chrome.storage.sync;

function area(): StorageArea {
  return chrome.storage.sync;
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await area().get([
    "augflowBaseUrl",
    "projectPath",
    "apiToken",
    "autoStartCard",
  ]);
  return {
    augflowBaseUrl:
      typeof raw.augflowBaseUrl === "string" && raw.augflowBaseUrl
        ? raw.augflowBaseUrl
        : DEFAULT_SETTINGS.augflowBaseUrl,
    projectPath: typeof raw.projectPath === "string" ? raw.projectPath : "",
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
