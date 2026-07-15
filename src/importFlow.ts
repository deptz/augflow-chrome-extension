import {
  augflowFetchJiraDefaultRepoSlug,
  augflowListRepos,
  augflowPatchTaskRepos,
  augflowPost,
} from "./lib/augflowClient";
import type { FromBackgroundResponse } from "./lib/messages";
import { getDefaultRepos, loadSettings } from "./lib/storage";

export type ImportFlowOptions = {
  projectPath?: string;
  repoSlugs?: string[];
  startAfterImport?: boolean;
};

function normalizeRepoSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const slug = raw.trim();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

async function resolveDefaultReposForProject(
  settings: Awaited<ReturnType<typeof loadSettings>>,
  projectPath: string
): Promise<string[]> {
  const stored = getDefaultRepos(settings, projectPath);
  if (stored.length > 0) {
    return stored;
  }
  const list = await augflowListRepos(settings, projectPath);
  if (!list.ok || list.data.repos.length === 0) {
    return [];
  }
  const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
  if (jiraDefault && list.data.repos.includes(jiraDefault)) {
    return [jiraDefault];
  }
  return list.data.repos[0] ? [list.data.repos[0]] : [];
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
  let repoSlugs = normalizeRepoSlugs(
    options.repoSlugs?.length ? options.repoSlugs : getDefaultRepos(settings, projectPath)
  );
  if (repoSlugs.length === 0) {
    repoSlugs = normalizeRepoSlugs(await resolveDefaultReposForProject(settings, projectPath));
  }

  const importRes = await augflowPost(
    settings,
    "/api/tasks/jira/import-by-key",
    { issue_key: issueKey },
    projectPath
  );
  if (!importRes.ok) {
    return { ok: false, message: importRes.message };
  }

  if (repoSlugs.length > 0) {
    const patchRes = await augflowPatchTaskRepos(settings, projectPath, issueKey, repoSlugs);
    if (!patchRes.ok) {
      const noun = repoSlugs.length > 1 ? "repositories" : "repository";
      return {
        ok: false,
        message: `Imported ${issueKey}, but ${noun} update failed: ${patchRes.message}`,
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
