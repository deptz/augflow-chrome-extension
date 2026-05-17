/** Extract repository slugs from GET /api/config/repos JSON. */
export function parseRepoSlugsFromConfigRepos(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }
  const repos = (data as { repos?: unknown }).repos;
  if (!repos || typeof repos !== "object" || Array.isArray(repos)) {
    return [];
  }
  return Object.keys(repos)
    .map((k) => k.trim())
    .filter((k) => k !== "")
    .sort((a, b) => a.localeCompare(b));
}

/** Read jira.default_repo_slug from GET /api/config when present. */
export function parseJiraDefaultRepoSlug(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }
  const jira = (data as { jira?: unknown }).jira;
  if (!jira || typeof jira !== "object" || Array.isArray(jira)) {
    return "";
  }
  const slug = (jira as { default_repo_slug?: unknown }).default_repo_slug;
  return typeof slug === "string" ? slug.trim() : "";
}
