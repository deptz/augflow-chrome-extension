import { parseApiErrorBody } from "./apiError";
import { ensureOriginPermission } from "./augflowPermissions";
import { parseJiraDefaultRepoSlug, parseRepoSlugsFromConfigRepos } from "./reposParse";
import { validateAugflowBaseUrl } from "./augflowUrl";
import type { ExtensionSettings } from "./storage";

export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function augflowRequest(
  settings: ExtensionSettings,
  path: string,
  init: RequestInit & { projectPath?: string }
): Promise<{ ok: true; response: Response } | { ok: false; message: string }> {
  const v = validateAugflowBaseUrl(settings.augflowBaseUrl);
  if (!v.ok) {
    return { ok: false, message: v.error };
  }

  const perm = await ensureOriginPermission(v.baseUrl);
  if (!perm.ok) {
    return { ok: false, message: perm.error };
  }

  const projectPath = (init.projectPath ?? settings.projectPath).trim();
  const needsProject =
    path.startsWith("/api/") && path !== "/api/projects" && path !== "/health";
  if (needsProject && !projectPath) {
    return { ok: false, message: "Set default project in extension options." };
  }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (projectPath && needsProject) {
    headers["X-Project-Path"] = projectPath;
  }
  const token = settings.apiToken.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${v.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const { projectPath: _pp, ...fetchInit } = init;
    const res = await fetch(url, { ...fetchInit, headers });
    return { ok: true, response: res };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Cannot reach Augflow (${v.baseUrl}): ${msg}` };
  }
}

export async function augflowGet(
  settings: ExtensionSettings,
  path: string,
  projectPath?: string
): Promise<FetchResult<string>> {
  const req = await augflowRequest(settings, path, {
    method: "GET",
    projectPath,
  });
  if (!req.ok) {
    return req;
  }
  const text = await req.response.text();
  if (!req.response.ok) {
    return { ok: false, message: parseApiErrorBody(text) };
  }
  return { ok: true, data: text };
}

export async function augflowPatch(
  settings: ExtensionSettings,
  path: string,
  body: unknown,
  projectPath?: string
): Promise<FetchResult<void>> {
  const req = await augflowRequest(settings, path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    projectPath,
  });
  if (!req.ok) {
    return req;
  }
  const text = await req.response.text();
  if (!req.response.ok) {
    return { ok: false, message: parseApiErrorBody(text) };
  }
  return { ok: true, data: undefined };
}

export async function augflowPost(
  settings: ExtensionSettings,
  path: string,
  body: unknown,
  projectPath?: string
): Promise<FetchResult<void>> {
  const req = await augflowRequest(settings, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    projectPath,
  });
  if (!req.ok) {
    return req;
  }
  const text = await req.response.text();
  if (!req.response.ok) {
    return { ok: false, message: parseApiErrorBody(text) };
  }
  return { ok: true, data: undefined };
}

export async function augflowHealthCheck(
  settings: ExtensionSettings
): Promise<FetchResult<void>> {
  const v = validateAugflowBaseUrl(settings.augflowBaseUrl);
  if (!v.ok) {
    return { ok: false, message: v.error };
  }
  const perm = await ensureOriginPermission(v.baseUrl);
  if (!perm.ok) {
    return { ok: false, message: perm.error };
  }
  try {
    const res = await fetch(`${v.baseUrl}/health`, { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `Health check failed (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Cannot reach Augflow: ${msg}` };
  }
}

export type ProjectEntry = { path: string };

export async function augflowListProjects(
  settings: ExtensionSettings
): Promise<FetchResult<ProjectEntry[]>> {
  const res = await augflowGet(settings, "/api/projects");
  if (!res.ok) {
    return res;
  }
  try {
    const parsed = JSON.parse(res.data) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, message: "Invalid projects response from Augflow." };
    }
    const projects = parsed
      .map((e) => {
        if (e && typeof e === "object" && "path" in e && typeof (e as { path: unknown }).path === "string") {
          return { path: (e as { path: string }).path.trim() };
        }
        return null;
      })
      .filter((p): p is ProjectEntry => p != null && p.path !== "");
    return { ok: true, data: projects };
  } catch {
    return { ok: false, message: "Could not parse projects list from Augflow." };
  }
}

export type ReposListResult = {
  repos: string[];
  jiraDefaultRepoSlug: string;
};

export async function augflowListRepos(
  settings: ExtensionSettings,
  projectPath: string
): Promise<FetchResult<ReposListResult>> {
  const res = await augflowGet(settings, "/api/config/repos", projectPath);
  if (!res.ok) {
    return res;
  }
  try {
    const parsed = JSON.parse(res.data) as unknown;
    return {
      ok: true,
      data: {
        repos: parseRepoSlugsFromConfigRepos(parsed),
        jiraDefaultRepoSlug: "",
      },
    };
  } catch {
    return { ok: false, message: "Could not parse repos list from Augflow." };
  }
}

export async function augflowFetchJiraDefaultRepoSlug(
  settings: ExtensionSettings,
  projectPath: string
): Promise<string> {
  const res = await augflowGet(settings, "/api/config", projectPath);
  if (!res.ok) {
    return "";
  }
  try {
    return parseJiraDefaultRepoSlug(JSON.parse(res.data) as unknown);
  } catch {
    return "";
  }
}

export async function augflowPatchTaskRepos(
  settings: ExtensionSettings,
  projectPath: string,
  taskId: string,
  repoSlugs: string[]
): Promise<FetchResult<void>> {
  return augflowPatch(
    settings,
    `/api/tasks/${encodeURIComponent(taskId)}`,
    { repo_slugs: repoSlugs, repo_slug: repoSlugs[0] },
    projectPath
  );
}
