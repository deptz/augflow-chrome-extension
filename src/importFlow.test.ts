import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionSettings } from "./lib/storage";

vi.mock("./lib/augflowClient", () => ({
  augflowPost: vi.fn(),
  augflowPatchTaskRepo: vi.fn(),
  augflowListRepos: vi.fn(),
  augflowFetchJiraDefaultRepoSlug: vi.fn(),
}));

vi.mock("./lib/storage", () => ({
  loadSettings: vi.fn(),
  getDefaultRepo: (settings: ExtensionSettings, projectPath: string) =>
    settings.defaultRepoByProject[projectPath.trim()] ?? "",
}));

import { augflowPatchTaskRepo, augflowPost } from "./lib/augflowClient";
import { loadSettings } from "./lib/storage";
import { runImportFlow } from "./importFlow";

const baseSettings: ExtensionSettings = {
  augflowBaseUrl: "http://localhost:4400",
  projectPath: "my-app",
  defaultRepoByProject: { "my-app": "api" },
  apiToken: "",
  autoStartCard: false,
};

describe("runImportFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSettings).mockResolvedValue(baseSettings);
    vi.mocked(augflowPost).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(augflowPatchTaskRepo).mockResolvedValue({ ok: true, data: undefined });
  });

  it("requires default project in options", async () => {
    vi.mocked(loadSettings).mockResolvedValue({ ...baseSettings, projectPath: "" });
    const result = await runImportFlow("PROJ-1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("default project");
    expect(augflowPost).not.toHaveBeenCalled();
  });

  it("imports only when autoStartCard is false and start not requested", async () => {
    const result = await runImportFlow("PROJ-1");
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Imported PROJ-1");
    expect(augflowPost).toHaveBeenCalledTimes(1);
    expect(vi.mocked(augflowPost).mock.calls[0]?.[1]).toBe("/api/tasks/jira/import-by-key");
  });

  it("starts card after import when autoStartCard is enabled", async () => {
    vi.mocked(loadSettings).mockResolvedValue({ ...baseSettings, autoStartCard: true });
    const result = await runImportFlow("PROJ-2");
    expect(result.ok).toBe(true);
    expect(result.message).toContain("started card");
    expect(augflowPost).toHaveBeenCalledTimes(2);
    expect(vi.mocked(augflowPost).mock.calls[1]?.[1]).toBe("/api/cards/start");
  });

  it("honors explicit startAfterImport over saved autoStartCard", async () => {
    vi.mocked(loadSettings).mockResolvedValue({ ...baseSettings, autoStartCard: true });
    const result = await runImportFlow("PROJ-3", { startAfterImport: false });
    expect(result.ok).toBe(true);
    expect(augflowPost).toHaveBeenCalledTimes(1);
  });

  it("patches repo slug after import when configured", async () => {
    await runImportFlow("PROJ-4");
    expect(augflowPatchTaskRepo).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "my-app" }),
      "my-app",
      "PROJ-4",
      "api"
    );
  });
});
