import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionSettings } from "./lib/storage";

vi.mock("./lib/augflowClient", () => ({
  augflowPost: vi.fn(),
  augflowPatchTaskRepos: vi.fn(),
  augflowListRepos: vi.fn(),
  augflowFetchJiraDefaultRepoSlug: vi.fn(),
}));

vi.mock("./lib/storage", () => ({
  loadSettings: vi.fn(),
  getDefaultRepos: (settings: ExtensionSettings, projectPath: string) =>
    settings.defaultRepoByProject[projectPath.trim()] ?? [],
}));

import {
  augflowFetchJiraDefaultRepoSlug,
  augflowListRepos,
  augflowPatchTaskRepos,
  augflowPost,
} from "./lib/augflowClient";
import { loadSettings } from "./lib/storage";
import { runImportFlow } from "./importFlow";

const baseSettings: ExtensionSettings = {
  augflowBaseUrl: "http://localhost:4400",
  projectPath: "my-app",
  defaultRepoByProject: { "my-app": ["api"] },
  apiToken: "",
  autoStartCard: false,
};

describe("runImportFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSettings).mockResolvedValue(baseSettings);
    vi.mocked(augflowPost).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(augflowPatchTaskRepos).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(augflowListRepos).mockResolvedValue({ ok: true, data: { repos: [], jiraDefaultRepoSlug: "" } });
    vi.mocked(augflowFetchJiraDefaultRepoSlug).mockResolvedValue("");
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

  it("patches repo slugs after import when configured", async () => {
    await runImportFlow("PROJ-4");
    expect(augflowPatchTaskRepos).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "my-app" }),
      "my-app",
      "PROJ-4",
      ["api"]
    );
  });

  it("passes the full multi-repo array through to augflowPatchTaskRepos (PATCH body itself is covered in augflowClient.test.ts)", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      ...baseSettings,
      defaultRepoByProject: { "my-app": ["api", "web"] },
    });
    await runImportFlow("PROJ-5");
    expect(augflowPatchTaskRepos).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "my-app" }),
      "my-app",
      "PROJ-5",
      ["api", "web"]
    );
  });

  it("uses explicit multi-repo selection from options over saved defaults", async () => {
    await runImportFlow("PROJ-6", { repoSlugs: [" web ", "api", "web"] });
    expect(augflowPatchTaskRepos).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "my-app" }),
      "my-app",
      "PROJ-6",
      ["web", "api"]
    );
  });

  it("skips repo patch entirely when no repos are selected or saved", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      ...baseSettings,
      defaultRepoByProject: {},
    });
    const result = await runImportFlow("PROJ-7");
    expect(result.ok).toBe(true);
    expect(augflowPatchTaskRepos).not.toHaveBeenCalled();
  });

  it("reports pluralized failure message when multi-repo patch fails", async () => {
    vi.mocked(augflowPatchTaskRepos).mockResolvedValue({ ok: false, message: "boom" });
    vi.mocked(loadSettings).mockResolvedValue({
      ...baseSettings,
      defaultRepoByProject: { "my-app": ["api", "web"] },
    });
    const result = await runImportFlow("PROJ-8");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("repositories update failed");
  });

  it("reports singular failure message when single-repo patch fails", async () => {
    vi.mocked(augflowPatchTaskRepos).mockResolvedValue({ ok: false, message: "boom" });
    const result = await runImportFlow("PROJ-9");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("repository update failed");
  });
});
