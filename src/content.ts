import { openImportDialog } from "./importDialog";
import { resolveIssueKey } from "./lib/issueKey";
import type { FromBackgroundResponse, GetCurrentIssueKeyResponse } from "./lib/messages";

const BTN_ID = "augflow-jira-bridge-btn";

function currentIssueKey(): string | null {
  return resolveIssueKey(location.href);
}

function broadcastIssueKey(): void {
  const key = currentIssueKey();
  chrome.runtime.sendMessage({ type: "issueKeyChanged", issueKey: key }).catch(() => {
    /* Extension context invalidated */
  });
}

function runImport(
  issueKey: string,
  opts: { projectPath?: string; repoSlug?: string; startAfterImport?: boolean }
): void {
  const btn = document.getElementById(BTN_ID) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Importing…";
  }
  chrome.runtime.sendMessage(
    {
      type: "importIssue",
      issueKey,
      source: "content",
      projectPath: opts.projectPath,
      repoSlug: opts.repoSlug,
      startAfterImport: opts.startAfterImport,
    } as const,
    (_res: FromBackgroundResponse) => {
      const lastErr = chrome.runtime.lastError?.message;
      if (btn) {
        if (lastErr) {
          btn.title = lastErr;
        }
        btn.disabled = false;
        btn.textContent = "Import to Augflow";
      }
    }
  );
}

function injectButton(): void {
  document.getElementById(BTN_ID)?.remove();

  const key = currentIssueKey();
  if (!key) {
    return;
  }

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.textContent = "Import to Augflow";
  btn.title = "Click to import. Shift+click for project, repository, and start options.";
  btn.setAttribute("aria-label", "Import current Jira issue to Augflow");
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483646",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    borderRadius: "6px",
    border: "1px solid #0052CC",
    background: "#0052CC",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(9,30,66,0.25)",
    fontFamily: "system-ui, sans-serif",
  } as CSSStyleDeclaration);

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#0747A6";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#0052CC";
  });

  btn.addEventListener("click", (e) => {
    const k = currentIssueKey();
    if (!k) {
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      openImportDialog(k, btn, (choice) => {
        runImport(k, {
          projectPath: choice.projectPath,
          repoSlug: choice.repoSlug,
          startAfterImport: choice.startAfterImport,
        });
      });
      return;
    }
    runImport(k, {});
  });

  document.body.appendChild(btn);
}

let routeDebounce: number | undefined;
let observerDebounce: number | undefined;

function scheduleRefresh(): void {
  if (routeDebounce !== undefined) {
    window.clearTimeout(routeDebounce);
  }
  routeDebounce = window.setTimeout(() => {
    routeDebounce = undefined;
    injectButton();
    broadcastIssueKey();
  }, 300);
}

function hookSpaNavigation(): void {
  window.addEventListener("popstate", scheduleRefresh);
  const origPush = history.pushState.bind(history);
  history.pushState = (...args: Parameters<History["pushState"]>) => {
    origPush(...args);
    scheduleRefresh();
  };
  const origReplace = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    origReplace(...args);
    scheduleRefresh();
  };
}

function hookDomObserver(): void {
  const observer = new MutationObserver(() => {
    if (observerDebounce !== undefined) {
      window.clearTimeout(observerDebounce);
    }
    observerDebounce = window.setTimeout(() => {
      observerDebounce = undefined;
      const prev = document.getElementById(BTN_ID);
      const key = currentIssueKey();
      if (key && !prev) {
        injectButton();
      } else if (!key && prev) {
        prev.remove();
      }
      broadcastIssueKey();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "getCurrentIssueKey") {
    sendResponse({ issueKey: currentIssueKey() } satisfies GetCurrentIssueKeyResponse);
    return true;
  }
  if (msg.type === "openImportDialog") {
    const k =
      typeof msg.issueKey === "string" && msg.issueKey ? msg.issueKey : currentIssueKey();
    if (k) {
      let anchor = document.getElementById(BTN_ID) as HTMLButtonElement | null;
      if (!anchor) {
        anchor = document.createElement("button");
        anchor.id = BTN_ID;
        Object.assign(anchor.style, {
          position: "fixed",
          bottom: "16px",
          right: "16px",
        } as CSSStyleDeclaration);
        document.body.appendChild(anchor);
      }
      openImportDialog(k, anchor, (choice) => {
        runImport(k, {
          projectPath: choice.projectPath,
          repoSlug: choice.repoSlug,
          startAfterImport: choice.startAfterImport,
        });
      });
    }
    sendResponse({ ok: true, message: "ok" });
    return true;
  }
  return false;
});

hookSpaNavigation();
hookDomObserver();
injectButton();
broadcastIssueKey();
