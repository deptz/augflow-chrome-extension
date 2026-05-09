import { describe, expect, vi, beforeEach, it } from "vitest";
import { DEFAULT_SETTINGS, ensureDefaultsOnInstall, loadSettings, saveSettings } from "./storage";

type StoreMap = Record<string, unknown>;

function createChromeMock(backing: StoreMap) {
  return {
    storage: {
      sync: {
        get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
          let fields: string[];
          if (typeof keys === "string") {
            fields = [keys];
          } else if (Array.isArray(keys)) {
            fields = keys;
          } else {
            fields = Object.keys(keys);
          }
          const out: Record<string, unknown> = {};
          for (const k of fields) {
            if (k in backing) {
              out[k] = backing[k];
            }
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(backing, items);
        }),
      },
    },
  };
}

describe("storage helpers", () => {
  let backing: StoreMap;

  beforeEach(() => {
    backing = {};
    vi.unstubAllGlobals();
    vi.stubGlobal("chrome", createChromeMock(backing) as unknown as typeof chrome);
  });

  it("loads defaults when storage empty", async () => {
    const s = await loadSettings();
    expect(s).toEqual({
      augflowBaseUrl: DEFAULT_SETTINGS.augflowBaseUrl,
      projectPath: "",
      apiToken: "",
      autoStartCard: false,
    });
  });

  it("respects persisted values", async () => {
    backing.augflowBaseUrl = "http://localhost:3000";
    backing.projectPath = "/tmp/p";
    backing.apiToken = "secret";
    backing.autoStartCard = true;

    const s = await loadSettings();
    expect(s).toMatchObject({
      augflowBaseUrl: "http://localhost:3000",
      projectPath: "/tmp/p",
      apiToken: "secret",
      autoStartCard: true,
    });
  });

  it("defaults augflow URL when unset string", async () => {
    backing.augflowBaseUrl = "";
    const s = await loadSettings();
    expect(s.augflowBaseUrl).toBe(DEFAULT_SETTINGS.augflowBaseUrl);
  });

  it("ensureDefaultsOnInstall seeds missing base URL key", async () => {
    expect(backing.augflowBaseUrl).toBeUndefined();
    await ensureDefaultsOnInstall();
    expect(backing.augflowBaseUrl).toBe(DEFAULT_SETTINGS.augflowBaseUrl);

    backing.augflowBaseUrl = "http://127.0.0.1:8080";
    await ensureDefaultsOnInstall();
    expect(backing.augflowBaseUrl).toBe("http://127.0.0.1:8080");
  });

  it("saveSettings forwards to chrome.storage.sync", async () => {
    await saveSettings({ projectPath: "/x" });
    expect(backing.projectPath).toBe("/x");
  });
});
