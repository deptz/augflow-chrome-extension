import { beforeEach, describe, expect, it, vi } from "vitest";
import { augflowPatchTaskRepos } from "./augflowClient";
import type { ExtensionSettings } from "./storage";

const baseSettings: ExtensionSettings = {
  augflowBaseUrl: "http://localhost:4400",
  projectPath: "proj",
  defaultRepoByProject: {},
  apiToken: "",
  autoStartCard: false,
};

function stubChromePermissions(): void {
  vi.stubGlobal("chrome", {
    permissions: {
      contains: vi.fn(async () => true),
      request: vi.fn(async () => true),
    },
  } as unknown as typeof chrome);
}

describe("augflowPatchTaskRepos", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubChromePermissions();
  });

  it("sends both repo_slugs (full array) and repo_slug (first element) in the PATCH body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await augflowPatchTaskRepos(baseSettings, "proj", "TASK-1", ["a", "b"]);

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4400/api/tasks/TASK-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      repo_slugs: ["a", "b"],
      repo_slug: "a",
    });
  });

  it("propagates a failure response from the server", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: "invalid repo" }), { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await augflowPatchTaskRepos(baseSettings, "proj", "TASK-2", ["a"]);
    expect(res.ok).toBe(false);
  });
});
