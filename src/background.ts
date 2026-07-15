import {
  augflowFetchJiraDefaultRepoSlug,
  augflowListProjects,
  augflowListRepos,
} from "./lib/augflowClient";
import { runImportFlow, type ImportFlowOptions } from "./importFlow";
import { extractIssueKeyFromUrl } from "./lib/issueKey";
import type {
  FromBackgroundResponse,
  GetCurrentIssueKeyResponse,
  ImportDialogDefaults,
  ListProjectsResponse,
  ListReposResponse,
  ToBackgroundMessage,
} from "./lib/messages";
import {
  ensureDefaultsOnInstall,
  getDefaultRepos,
  loadSettings,
} from "./lib/storage";

const BADGE_LOADING = "…";
const NOTIFY_ID = "augflow-jira-bridge";
const CONTEXT_IMPORT_OPTIONS = "augflow-import-with-options";

/** Per-tab issue key from content script (SPA-aware). */
const tabIssueKeys = new Map<number, string | null>();

function isJiraCloudHost(hostname: string): boolean {
  return hostname === "atlassian.net" || hostname.endsWith(".atlassian.net");
}

function tabIssueKeyFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const u = new URL(url);
    if (!isJiraCloudHost(u.hostname)) {
      return null;
    }
    return extractIssueKeyFromUrl(url);
  } catch {
    return null;
  }
}

function resolvedTabKey(tabId: number, url: string | undefined): string | null {
  if (tabIssueKeys.has(tabId)) {
    const cached = tabIssueKeys.get(tabId);
    if (cached) {
      return cached;
    }
  }
  return tabIssueKeyFromUrl(url);
}

async function setActionStateForTab(tabId: number, url: string | undefined): Promise<void> {
  try {
    const key = resolvedTabKey(tabId, url);
    if (key) {
      await chrome.action.enable(tabId);
      await chrome.action.setTitle({
        tabId,
        title: `Import ${key} to Augflow`,
      });
    } else {
      await chrome.action.disable(tabId);
      await chrome.action.setTitle({
        tabId,
        title: "Open a Jira issue page (atlassian.net)",
      });
    }
  } catch {
    /* Restricted URLs */
  }
}

async function refreshAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id != null) {
      await setActionStateForTab(t.id, t.url);
    }
  }
}

export type { ImportFlowOptions };
export { runImportFlow };

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

/** Fallback used when stored defaults are empty or none of them are present in the fetched repo list. */
async function fallbackReposFromList(
  settings: Awaited<ReturnType<typeof loadSettings>>,
  projectPath: string,
  repos: string[]
): Promise<string[]> {
  const jiraDefault = await augflowFetchJiraDefaultRepoSlug(settings, projectPath);
  if (jiraDefault && repos.includes(jiraDefault)) {
    return [jiraDefault];
  }
  return repos[0] ? [repos[0]] : [];
}

function notify(title: string, message: string): void {
  chrome.notifications.create(NOTIFY_ID, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
  });
}

async function withBadge<T>(work: () => Promise<T>): Promise<T> {
  await chrome.action.setBadgeText({ text: BADGE_LOADING });
  await chrome.action.setBadgeBackgroundColor({ color: "#505050" });
  try {
    return await work();
  } finally {
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function queryContentIssueKey(tabId: number): Promise<string | null> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, {
      type: "getCurrentIssueKey",
    })) as GetCurrentIssueKeyResponse | undefined;
    if (res?.issueKey) {
      return res.issueKey;
    }
  } catch {
    /* Content script not injected */
  }
  return null;
}

async function resolveIssueKeyForTab(tab: chrome.tabs.Tab): Promise<string | null> {
  if (tab.id == null) {
    return null;
  }
  const fromContent = await queryContentIssueKey(tab.id);
  if (fromContent) {
    tabIssueKeys.set(tab.id, fromContent);
    return fromContent;
  }
  return resolvedTabKey(tab.id, tab.url);
}

async function handleImportAttempt(
  tab: chrome.tabs.Tab,
  options: ImportFlowOptions = {},
  silent = false
): Promise<FromBackgroundResponse> {
  const key = await resolveIssueKeyForTab(tab);
  if (!key) {
    const msg = "No issue key on this page. Open an issue or use the on-page button.";
    if (!silent) {
      notify("Augflow", msg);
    }
    return { ok: false, message: msg };
  }

  return withBadge(() => runImportFlow(key, options));
}

async function openImportDialogOnTab(tabId: number, issueKey?: string): Promise<void> {
  const key =
    issueKey ??
    tabIssueKeys.get(tabId) ??
    (await queryContentIssueKey(tabId)) ??
    null;
  if (!key) {
    notify("Augflow", "No issue key on this page.");
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: "openImportDialog", issueKey: key });
  } catch {
    notify("Augflow", "Could not open import dialog on this tab.");
  }
}

function setupContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_IMPORT_OPTIONS,
      title: "Import with options…",
      contexts: ["action"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultsOnInstall().then(() => {
    setupContextMenu();
    return refreshAllTabs();
  });
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await setActionStateForTab(activeInfo.tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url != null) {
    void setActionStateForTab(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabIssueKeys.delete(tabId);
});

chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    const result = await handleImportAttempt(tab, {}, false);
    notify(result.ok ? "Augflow" : "Augflow — error", result.message);
  })();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_IMPORT_OPTIONS && tab?.id != null) {
    void openImportDialogOnTab(tab.id);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "import-with-options" && tab?.id != null) {
    void openImportDialogOnTab(tab.id);
  }
});

chrome.runtime.onMessage.addListener(
  (msg: ToBackgroundMessage, sender, sendResponse) => {
    if (msg.type === "ping") {
      sendResponse({ ok: true, message: "ok" } satisfies FromBackgroundResponse);
      return true;
    }

    if (msg.type === "issueKeyChanged") {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        tabIssueKeys.set(tabId, msg.issueKey);
        void setActionStateForTab(tabId, sender.tab?.url);
      }
      return false;
    }

    if (msg.type === "listProjects") {
      void (async () => {
        const settings = await loadSettings();
        const res = await augflowListProjects(settings);
        if (!res.ok) {
          sendResponse({
            ok: false,
            message: res.message,
          } satisfies ListProjectsResponse);
          return;
        }
        sendResponse({
          ok: true,
          projects: res.data,
          defaultProject: settings.projectPath.trim(),
        } satisfies ListProjectsResponse);
      })();
      return true;
    }

    if (msg.type === "listRepos") {
      void (async () => {
        const settings = await loadSettings();
        const projectPath = msg.projectPath.trim();
        if (!projectPath) {
          sendResponse({
            ok: false,
            message: "Project is required to list repositories.",
          } satisfies ListReposResponse);
          return;
        }
        const list = await augflowListRepos(settings, projectPath);
        if (!list.ok) {
          sendResponse({ ok: false, message: list.message } satisfies ListReposResponse);
          return;
        }
        let defaultRepoSlugs = getDefaultRepos(settings, projectPath).filter((slug) =>
          list.data.repos.includes(slug)
        );
        if (defaultRepoSlugs.length === 0) {
          defaultRepoSlugs = await fallbackReposFromList(settings, projectPath, list.data.repos);
        }
        sendResponse({
          ok: true,
          repos: list.data.repos,
          defaultRepoSlugs,
        } satisfies ListReposResponse);
      })();
      return true;
    }

    if (msg.type === "getImportDefaults") {
      void (async () => {
        const settings = await loadSettings();
        const defaultProject = settings.projectPath.trim();
        let defaultRepoSlugs: string[] = [];
        if (defaultProject) {
          const stored = getDefaultRepos(settings, defaultProject);
          defaultRepoSlugs =
            stored.length > 0 ? stored : await resolveDefaultReposForProject(settings, defaultProject);
        }
        sendResponse({
          defaultProject,
          defaultRepoSlugs,
          autoStartCard: settings.autoStartCard,
        } satisfies ImportDialogDefaults);
      })();
      return true;
    }

    if (msg.type === "importIssue") {
      void (async () => {
        const result = await withBadge(() =>
          runImportFlow(msg.issueKey, {
            projectPath: msg.projectPath,
            repoSlugs: msg.repoSlugs,
            startAfterImport: msg.startAfterImport,
          })
        );
        if (msg.source === "content") {
          notify(result.ok ? "Augflow" : "Augflow — error", result.message);
        }
        sendResponse(result);
      })();
      return true;
    }

    return false;
  }
);

void refreshAllTabs();
setupContextMenu();
