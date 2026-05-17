export type RegisteredProject = { path: string };

export type ToBackgroundMessage =
  | {
      type: "importIssue";
      issueKey: string;
      source?: "action" | "content";
      projectPath?: string;
      repoSlug?: string;
      startAfterImport?: boolean;
    }
  | { type: "issueKeyChanged"; issueKey: string | null }
  | { type: "getCurrentIssueKey" }
  | { type: "listProjects" }
  | { type: "listRepos"; projectPath: string }
  | { type: "getImportDefaults" }
  | { type: "openImportDialog"; issueKey?: string }
  | { type: "ping" };

export type FromBackgroundResponse =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type GetCurrentIssueKeyResponse = { issueKey: string | null };

export type ListProjectsResponse =
  | { ok: true; projects: RegisteredProject[]; defaultProject: string }
  | { ok: false; message: string };

export type ListReposResponse =
  | { ok: true; repos: string[]; defaultRepoSlug: string }
  | { ok: false; message: string };

export type ImportDialogDefaults = {
  defaultProject: string;
  defaultRepoSlug: string;
  autoStartCard: boolean;
};
