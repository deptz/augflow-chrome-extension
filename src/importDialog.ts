import { runtimeSendMessagePromise } from "./lib/extensionContext";
import type {
  ImportDialogDefaults,
  ListProjectsResponse,
  ListReposResponse,
} from "./lib/messages";

const PANEL_ID = "augflow-import-dialog-host";

export type ImportDialogSubmit = {
  projectPath: string;
  repoSlug: string;
  startAfterImport: boolean;
};

export function openImportDialog(
  issueKey: string,
  anchor: HTMLElement,
  onSubmit: (choice: ImportDialogSubmit) => void
): void {
  document.getElementById(PANEL_ID)?.remove();

  const host = document.createElement("div");
  host.id = PANEL_ID;
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "rgba(9, 30, 66, 0.45)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: "16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as CSSStyleDeclaration);

  const shadow = host.attachShadow({ mode: "open" });
  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Import to Augflow");
  Object.assign(panel.style, {
    background: "#fff",
    color: "#172b4d",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(9, 30, 66, 0.25)",
    padding: "16px",
    minWidth: "280px",
    maxWidth: "360px",
  } as CSSStyleDeclaration);

  const rect = anchor.getBoundingClientRect();
  panel.style.marginBottom = `${Math.max(16, window.innerHeight - rect.top + 8)}px`;

  const title = document.createElement("h2");
  title.textContent = `Import ${issueKey}`;
  Object.assign(title.style, {
    margin: "0 0 12px",
    fontSize: "15px",
    fontWeight: "600",
  } as CSSStyleDeclaration);

  const projectLabel = document.createElement("label");
  projectLabel.textContent = "Project";
  Object.assign(projectLabel.style, labelStyle());

  const projectSelect = document.createElement("select");
  Object.assign(projectSelect.style, selectStyle());

  const repoLabel = document.createElement("label");
  repoLabel.textContent = "Repository";
  Object.assign(repoLabel.style, { ...labelStyle(), marginTop: "8px" } as CSSStyleDeclaration);

  const repoSelect = document.createElement("select");
  Object.assign(repoSelect.style, selectStyle());
  const repoLoadingOpt = document.createElement("option");
  repoLoadingOpt.textContent = "Select a project first…";
  repoSelect.appendChild(repoLoadingOpt);
  repoSelect.disabled = true;

  const actionLabel = document.createElement("span");
  actionLabel.textContent = "After import";
  Object.assign(actionLabel.style, {
    ...labelStyle(),
    marginTop: "8px",
  } as CSSStyleDeclaration);

  const actionGroup = document.createElement("div");
  Object.assign(actionGroup.style, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "14px",
  } as CSSStyleDeclaration);

  const importOnlyInput = document.createElement("input");
  importOnlyInput.type = "radio";
  importOnlyInput.name = "augflow-action";
  importOnlyInput.checked = true;
  const importOnly = document.createElement("label");
  importOnly.append(importOnlyInput, document.createTextNode(" Import only"));

  const importStartInput = document.createElement("input");
  importStartInput.type = "radio";
  importStartInput.name = "augflow-action";
  const importStart = document.createElement("label");
  importStart.append(importStartInput, document.createTextNode(" Import + start card"));

  for (const lbl of [importOnly, importStart]) {
    Object.assign(lbl.style, { fontSize: "13px", cursor: "pointer" } as CSSStyleDeclaration);
  }
  actionGroup.append(importOnly, importStart);

  const status = document.createElement("p");
  Object.assign(status.style, {
    margin: "0 0 8px",
    fontSize: "12px",
    color: "#de350b",
    minHeight: "1em",
  } as CSSStyleDeclaration);

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.textContent = "Import";
  importBtn.disabled = true;
  Object.assign(importBtn.style, primaryBtnStyle());

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, secondaryBtnStyle());

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  } as CSSStyleDeclaration);
  btnRow.append(cancelBtn, importBtn);

  panel.append(
    title,
    projectLabel,
    projectSelect,
    repoLabel,
    repoSelect,
    actionLabel,
    actionGroup,
    status,
    btnRow
  );
  shadow.append(panel);

  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  panel.addEventListener("click", (e) => e.stopPropagation());

  function updateImportEnabled(): void {
    const hasProject = Boolean(projectSelect.value.trim());
    const hasRepo = Boolean(repoSelect.value.trim()) && !repoSelect.disabled;
    importBtn.disabled = !(hasProject && hasRepo);
  }

  async function loadReposForProject(projectPath: string): Promise<void> {
    repoSelect.innerHTML = "";
    const loading = document.createElement("option");
    loading.textContent = "Loading repositories…";
    repoSelect.appendChild(loading);
    repoSelect.disabled = true;
    updateImportEnabled();

    if (!projectPath) {
      repoSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.textContent = "Select a project first…";
      repoSelect.appendChild(opt);
      updateImportEnabled();
      return;
    }

    try {
      const res = await runtimeSendMessagePromise<ListReposResponse>({
        type: "listRepos",
        projectPath,
      });
      repoSelect.innerHTML = "";
      if (!res.ok) {
        status.textContent = res.message;
        const opt = document.createElement("option");
        opt.textContent = "(failed to load)";
        repoSelect.appendChild(opt);
        updateImportEnabled();
        return;
      }
      if (res.repos.length === 0) {
        status.textContent = "No repositories configured for this project.";
        const opt = document.createElement("option");
        opt.textContent = "(none)";
        repoSelect.appendChild(opt);
        updateImportEnabled();
        return;
      }
      status.textContent = "";
      for (const slug of res.repos) {
        const opt = document.createElement("option");
        opt.value = slug;
        opt.textContent = slug;
        if (slug === res.defaultRepoSlug) {
          opt.selected = true;
        }
        repoSelect.appendChild(opt);
      }
      repoSelect.disabled = false;
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
    updateImportEnabled();
  }

  function dismiss(): void {
    host.remove();
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      dismiss();
    }
  }

  host.addEventListener("mousedown", (e) => {
    if (e.composedPath()[0] === host) {
      dismiss();
    }
  });
  cancelBtn.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKey);

  projectSelect.addEventListener("change", () => {
    void loadReposForProject(projectSelect.value.trim());
  });

  repoSelect.addEventListener("change", () => {
    status.textContent = "";
    updateImportEnabled();
  });

  importBtn.addEventListener("click", () => {
    const projectPath = projectSelect.value.trim();
    const repoSlug = repoSelect.value.trim();
    if (!projectPath) {
      status.textContent = "Select a project.";
      return;
    }
    if (!repoSlug) {
      status.textContent = "Select a repository.";
      return;
    }
    dismiss();
    onSubmit({
      projectPath,
      repoSlug,
      startAfterImport: importStartInput.checked,
    });
  });

  document.body.appendChild(host);

  void (async () => {
    const loadingOpt = document.createElement("option");
    loadingOpt.textContent = "Loading projects…";
    projectSelect.appendChild(loadingOpt);
    projectSelect.disabled = true;

    try {
      const [res, defaults] = await Promise.all([
        runtimeSendMessagePromise<ListProjectsResponse>({ type: "listProjects" }),
        runtimeSendMessagePromise<ImportDialogDefaults>({ type: "getImportDefaults" }).catch(
          () => null
        ),
      ]);

      projectSelect.innerHTML = "";
      if (!res.ok) {
        status.textContent = res.message;
        return;
      }

      const { projects, defaultProject } = res;
      let selectedProject = defaultProject;
      if (projects.length === 0 && defaultProject) {
        const opt = document.createElement("option");
        opt.value = defaultProject;
        opt.textContent = defaultProject;
        projectSelect.appendChild(opt);
      } else {
        for (const p of projects) {
          const opt = document.createElement("option");
          opt.value = p.path;
          opt.textContent = p.path;
          if (p.path === defaultProject) {
            opt.selected = true;
          }
          projectSelect.appendChild(opt);
        }
        if (defaultProject && !projects.some((p) => p.path === defaultProject)) {
          const opt = document.createElement("option");
          opt.value = defaultProject;
          opt.textContent = `${defaultProject} (default)`;
          opt.selected = true;
          projectSelect.insertBefore(opt, projectSelect.firstChild);
        }
      }
      projectSelect.disabled = false;
      selectedProject = projectSelect.value.trim() || defaultProject;

      if (defaults?.autoStartCard) {
        importStartInput.checked = true;
      }

      await loadReposForProject(selectedProject);
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
  })();
}

function labelStyle(): Partial<CSSStyleDeclaration> {
  return {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "4px",
  };
}

function selectStyle(): Partial<CSSStyleDeclaration> {
  return {
    width: "100%",
    padding: "6px 8px",
    marginBottom: "4px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid #dfe1e6",
  };
}

function primaryBtnStyle(): Partial<CSSStyleDeclaration> {
  return {
    padding: "6px 12px",
    borderRadius: "4px",
    border: "1px solid #0052cc",
    background: "#0052cc",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
  };
}

function secondaryBtnStyle(): Partial<CSSStyleDeclaration> {
  return {
    padding: "6px 12px",
    borderRadius: "4px",
    border: "1px solid #dfe1e6",
    background: "#fff",
    cursor: "pointer",
    fontSize: "13px",
  };
}
