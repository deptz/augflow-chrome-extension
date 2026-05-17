import { describe, expect, it } from "vitest";
import { parseJiraDefaultRepoSlug, parseRepoSlugsFromConfigRepos } from "./reposParse";

describe("parseRepoSlugsFromConfigRepos", () => {
  it("returns sorted slug keys", () => {
    expect(
      parseRepoSlugsFromConfigRepos({
        repos: { zebra: "/z", api: "/a" },
      })
    ).toEqual(["api", "zebra"]);
  });

  it("returns empty for invalid payload", () => {
    expect(parseRepoSlugsFromConfigRepos(null)).toEqual([]);
    expect(parseRepoSlugsFromConfigRepos({})).toEqual([]);
  });
});

describe("parseJiraDefaultRepoSlug", () => {
  it("reads jira.default_repo_slug", () => {
    expect(
      parseJiraDefaultRepoSlug({
        jira: { default_repo_slug: "api" },
      })
    ).toBe("api");
  });

  it("returns empty when missing", () => {
    expect(parseJiraDefaultRepoSlug({})).toBe("");
  });
});
