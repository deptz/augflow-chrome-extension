import { parseApiErrorBody } from "./lib/apiError";
import { validateAugflowBaseUrl } from "./lib/augflowUrl";
import { extractIssueKeyFromUrl } from "./lib/issueKey";
import {
  ensureDefaultsOnInstall,
  loadSettings,
  type ExtensionSettings,
} from "./lib/storage";
import type { FromBackgroundResponse, ToBackgroundMessage } from "./lib/messages";

const BADGE_LOADING = "…";
const NOTIFY_ID = "augflow-jira-bridge";

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

async function setActionStateForTab(tabId: number, url: string | undefined): Promise<void> {
  try {
    const key = tabIssueKeyFromUrl(url);
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
    /* Restricted URLs (chrome://, etc.) */
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

async function augflowPost(
  settings: ExtensionSettings,
  path: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = validateAugflowBaseUrl(settings.augflowBaseUrl);
  if (!v.ok) {
    return { ok: false, message: v.error };
  }
  const projectPath = settings.projectPath.trim();
  if (!projectPath) {
    return { ok: false, message: "Set project path in extension options (X-Project-Path)." };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Project-Path": projectPath,
  };
  const token = settings.apiToken.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${v.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Cannot reach Augflow (${v.baseUrl}): ${msg}`,
    };
  }

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: parseApiErrorBody(text) };
  }
  return { ok: true };
}

export async function runImportFlow(issueKey: string): Promise<FromBackgroundResponse> {
  const settings = await loadSettings();
  const importRes = await augflowPost(settings, "/api/tasks/jira/import-by-key", {
    issue_key: issueKey,
  });
  if (!importRes.ok) {
    return { ok: false, message: importRes.message };
  }

  if (settings.autoStartCard) {
    const startRes = await augflowPost(settings, "/api/cards/start", {
      task_ids: [issueKey],
    });
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

async function handleImportAttempt(issueKey: string, silent = false): Promise<void> {
  await withBadge(async () => {
    const result = await runImportFlow(issueKey);
    if (!silent) {
      notify(result.ok ? "Augflow" : "Augflow — error", result.message);
    } else if (!result.ok) {
      console.warn("[augflow-bridge]", result.message);
    }
    return result;
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultsOnInstall().then(refreshAllTabs);
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

chrome.action.onClicked.addListener((tab) => {
  const key = tabIssueKeyFromUrl(tab.url);
  if (!key) {
    notify("Augflow", "No issue key in this tab URL. Open an issue or use the on-page button.");
    return;
  }
  void handleImportAttempt(key, false);
});

chrome.runtime.onMessage.addListener(
  (msg: ToBackgroundMessage, _sender, sendResponse: (r: FromBackgroundResponse) => void) => {
    if (msg.type === "ping") {
      sendResponse({ ok: true, message: "ok" });
      return true;
    }
    if (msg.type === "importIssue") {
      void (async () => {
        const result = await withBadge(() => runImportFlow(msg.issueKey));
        if (msg.source === "content") {
          notify(
            result.ok ? "Augflow" : "Augflow — error",
            result.message
          );
        }
        sendResponse(result);
      })();
      return true;
    }
    return false;
  }
);

void refreshAllTabs();
