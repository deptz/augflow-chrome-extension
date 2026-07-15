import { describe, expect, vi, beforeEach, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  ensureDefaultsOnInstall,
  getDefaultRepos,
  loadSettings,
  saveSettings,
  withDefaultRepos,
} from "./storage";

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
      defaultRepoByProject: {},
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

  it("saveSettings merges with existing values in chrome.storage.sync", async () => {
    backing.augflowBaseUrl = "http://localhost:3000";
    backing.apiToken = "keep-me";
    await saveSettings({ projectPath: "/x" });
    expect(backing.projectPath).toBe("/x");
    expect(backing.augflowBaseUrl).toBe("http://localhost:3000");
    expect(backing.apiToken).toBe("keep-me");
  });

  it("getDefaultRepos and withDefaultRepos are per-project", async () => {
    const base = await loadSettings();
    const updated = {
      ...base,
      defaultRepoByProject: withDefaultRepos(base, "my-app", ["api"]),
    };
    expect(getDefaultRepos(updated, "my-app")).toEqual(["api"]);
    expect(getDefaultRepos(updated, "other")).toEqual([]);
  });

  it("withDefaultRepos supports multiple repos and trims/dedupes", async () => {
    const base = await loadSettings();
    const updated = {
      ...base,
      defaultRepoByProject: withDefaultRepos(base, "my-app", [" api ", "web", "api", ""]),
    };
    expect(getDefaultRepos(updated, "my-app")).toEqual(["api", "web"]);
  });

  it("withDefaultRepos returns shallow copy unchanged when key or slugs empty", async () => {
    const base = await loadSettings();
    expect(withDefaultRepos(base, "", ["api"])).toEqual(base.defaultRepoByProject);
    expect(withDefaultRepos(base, "my-app", [])).toEqual(base.defaultRepoByProject);
    expect(withDefaultRepos(base, "my-app", ["  "])).toEqual(base.defaultRepoByProject);
  });

  it("migrates legacy single-string per-project default on load", async () => {
    backing.defaultRepoByProject = { "my-app": "api" };
    const s = await loadSettings();
    expect(getDefaultRepos(s, "my-app")).toEqual(["api"]);
  });

  it("drops empty legacy string value for a project", async () => {
    backing.defaultRepoByProject = { "my-app": "   " };
    const s = await loadSettings();
    expect(getDefaultRepos(s, "my-app")).toEqual([]);
    expect(s.defaultRepoByProject).not.toHaveProperty("my-app");
  });

  it("round-trips array values, trimming and deduping and dropping empties", async () => {
    backing.defaultRepoByProject = { "my-app": [" api ", "web", "api", "", "  "] };
    const s = await loadSettings();
    expect(getDefaultRepos(s, "my-app")).toEqual(["api", "web"]);
  });

  it("skips empty/whitespace project keys", async () => {
    backing.defaultRepoByProject = { "  ": ["api"], "my-app": ["web"] };
    const s = await loadSettings();
    expect(Object.keys(s.defaultRepoByProject)).toEqual(["my-app"]);
  });

  it("ignores malformed defaultRepoByProject payloads", async () => {
    backing.defaultRepoByProject = "not-an-object";
    const s = await loadSettings();
    expect(s.defaultRepoByProject).toEqual({});
  });
});
