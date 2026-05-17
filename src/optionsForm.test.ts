import { describe, expect, it } from "vitest";
import {
  applySelectPlan,
  formatSavedProjectHint,
  formatSavedRepoHint,
  HINT_PROJECT_LOAD_FIRST,
  HINT_PROJECT_SUCCESS,
  HINT_REPO_LOAD_FIRST,
  HINT_REPO_NEED_PROJECT,
  HINT_REPO_NONE,
  HINT_REPO_SUCCESS,
  planProjectsPopulate,
  planReposPopulate,
  resolveProjectPathValue,
  resolveRepoSlugFromForm,
} from "./optionsForm";

describe("resolveProjectPathValue", () => {
  it("uses visible select when displayed and non-empty", () => {
    expect(resolveProjectPathValue(true, "my-app", "legacy")).toBe("my-app");
  });

  it("falls back to hidden stored value when select hidden", () => {
    expect(resolveProjectPathValue(false, "", "saved-app")).toBe("saved-app");
  });

  it("falls back to hidden when select visible but empty", () => {
    expect(resolveProjectPathValue(true, "", "saved-app")).toBe("saved-app");
  });
});

describe("resolveRepoSlugFromForm", () => {
  it("returns slug only when repo select is visible", () => {
    expect(resolveRepoSlugFromForm(true, "api")).toBe("api");
    expect(resolveRepoSlugFromForm(false, "api")).toBe("");
    expect(resolveRepoSlugFromForm(true, "")).toBe("");
  });
});

describe("planProjectsPopulate", () => {
  it("hides select and surfaces API error", () => {
    const plan = planProjectsPopulate({ ok: false, message: "Network error" }, "my-app");
    expect(plan.showSelect).toBe(false);
    expect(plan.hint).toBe("Network error");
    expect(plan.selected).toBe("my-app");
  });

  it("hides select when list empty and nothing saved", () => {
    const plan = planProjectsPopulate({ ok: true, projects: [] }, "");
    expect(plan.showSelect).toBe(false);
    expect(plan.hint).toBe("No projects registered in Augflow yet.");
  });

  it("hides select when list empty but keeps saved path in hint", () => {
    const plan = planProjectsPopulate({ ok: true, projects: [] }, "orphan");
    expect(plan.hint).toContain("orphan");
    expect(plan.selected).toBe("orphan");
  });

  it("shows select with projects and preserves saved selection", () => {
    const plan = planProjectsPopulate(
      { ok: true, projects: ["alpha", "beta"] },
      "beta"
    );
    expect(plan.showSelect).toBe(true);
    expect(plan.hint).toBe(HINT_PROJECT_SUCCESS);
    expect(plan.options).toEqual(["alpha", "beta"]);
    expect(plan.selected).toBe("beta");
  });

  it("adds saved path as option when not returned by API", () => {
    const plan = planProjectsPopulate({ ok: true, projects: ["alpha"] }, "legacy");
    expect(plan.options).toEqual(["alpha", "legacy"]);
    expect(plan.selected).toBe("legacy");
  });

  it("does not auto-select first project when nothing saved", () => {
    const plan = planProjectsPopulate({ ok: true, projects: ["alpha", "beta"] }, "");
    expect(plan.selected).toBe("");
  });
});

describe("planReposPopulate", () => {
  it("requires a project path first", () => {
    const plan = planReposPopulate("", { ok: true, repos: ["api"] });
    expect(plan.showSelect).toBe(false);
    expect(plan.hint).toBe(HINT_REPO_NEED_PROJECT);
  });

  it("surfaces repo API errors", () => {
    const plan = planReposPopulate("my-app", { ok: false, message: "403 Forbidden" });
    expect(plan.hint).toBe("403 Forbidden");
  });

  it("handles empty repo list", () => {
    const plan = planReposPopulate("my-app", { ok: true, repos: [] });
    expect(plan.hint).toBe(HINT_REPO_NONE);
  });

  it("shows select when repos exist", () => {
    const plan = planReposPopulate("my-app", { ok: true, repos: ["api", "web"] });
    expect(plan.showSelect).toBe(true);
    expect(plan.hint).toBe(HINT_REPO_SUCCESS);
    expect(plan.repos).toEqual(["api", "web"]);
  });
});

describe("applySelectPlan", () => {
  it("populates and shows the select when plan.showSelect is true", () => {
    document.body.innerHTML = "<select></select>";
    const select = document.querySelector("select") as HTMLSelectElement;
    applySelectPlan(select, {
      showSelect: true,
      options: ["alpha", "beta"],
      selected: "beta",
    });
    expect(select.style.display).toBe("block");
    expect(select.value).toBe("beta");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["alpha", "beta"]);
  });

  it("hides and clears the select when plan.showSelect is false", () => {
    document.body.innerHTML = "<select><option value='x'>x</option></select>";
    const select = document.querySelector("select") as HTMLSelectElement;
    applySelectPlan(select, { showSelect: false, options: [], selected: "" });
    expect(select.style.display).toBe("none");
    expect(select.options.length).toBe(0);
  });
});

describe("saved selection hints", () => {
  it("shows saved project when set", () => {
    expect(formatSavedProjectHint("my-app")).toContain("my-app");
  });

  it("falls back to load-first hint when project empty", () => {
    expect(formatSavedProjectHint("")).toBe(HINT_PROJECT_LOAD_FIRST);
  });

  it("shows saved repository when project and repo set", () => {
    expect(formatSavedRepoHint("my-app", "api")).toContain("api");
  });

  it("falls back when repo missing", () => {
    expect(formatSavedRepoHint("my-app", "")).toBe(HINT_REPO_LOAD_FIRST);
  });
});

describe("options page copy", () => {
  it("initial project hint matches load-first constant", () => {
    expect(HINT_PROJECT_LOAD_FIRST).toContain("Test connection");
  });
});
