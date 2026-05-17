import {
  augflowFetchJiraDefaultRepoSlug,
  augflowListRepos,
  augflowPatchTaskRepo,
  augflowPost,
} from "./lib/augflowClient";
import type { FromBackgroundResponse } from "./lib/messages";
import { getDefaultRepo, loadSettings } from "./lib/storage";

export type ImportFlowOptions = {
  projectPath?: string;
  repoSlug?: string;
  startAfterImport?: boolean;
};

async function resolveDefaultRepoSlugForProject(
  settings: Awaited<ReturnType<typeof loadSettings>>,
  projectPath: string
): Promise<string> {
  const stored = getDefaultRepo(settings, projectPath);
  if (stored) {
    return stored;
  }
  const list = await augflowListRepos(settings, projectPath);
  if (!list.ok || list.data.repos.length === 0) {
    return "";
  }
  const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
  if (jiraDefault && list.data.repos.includes(jiraDefault)) {
    return jiraDefault;
  }
  return list.data.repos[0] ?? "";
}

export async function runImportFlow(
  issueKey: string,
  options: ImportFlowOptions = {}
): Promise<FromBackgroundResponse> {
  const settings = await loadSettings();
  const projectPath = (options.projectPath ?? settings.projectPath).trim();
  if (!projectPath) {
    return { ok: false, message: "Set default project in extension options." };
  }

  const startAfterImport = options.startAfterImport ?? settings.autoStartCard;
  const repoSlug = (
    options.repoSlug?.trim() ||
    getDefaultRepo(settings, projectPath) ||
    (await resolveDefaultRepoSlugForProject(settings, projectPath))
  ).trim();

  const importRes = await augflowPost(
    settings,
    "/api/tasks/jira/import-by-key",
    { issue_key: issueKey },
    projectPath
  );
  if (!importRes.ok) {
    return { ok: false, message: importRes.message };
  }

  if (repoSlug) {
    const patchRes = await augflowPatchTaskRepo(settings, projectPath, issueKey, repoSlug);
    if (!patchRes.ok) {
      return {
        ok: false,
        message: `Imported ${issueKey}, but repository update failed: ${patchRes.message}`,
      };
    }
  }

  if (startAfterImport) {
    const startRes = await augflowPost(
      settings,
      "/api/cards/start",
      { task_ids: [issueKey] },
      projectPath
    );
    if (!startRes.ok) {
      return {
        ok: false,
        message: `Imported ${issueKey}, but start failed: ${startRes.message}`,
      };
    }
    return {
      ok: true,
      message: `Imported and started card for ${issueKey}.`,
    };
  }

  return { ok: true, message: `Imported ${issueKey} into Augflow.` };
}
