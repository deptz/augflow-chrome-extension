import { extractIssueKeyFromDom, extractIssueKeyFromUrl } from "./lib/issueKey";
import type { FromBackgroundResponse } from "./lib/messages";

const BTN_ID = "augflow-jira-bridge-btn";

function currentIssueKey(): string | null {
  return extractIssueKeyFromUrl(location.href) ?? extractIssueKeyFromDom();
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

  btn.addEventListener("click", () => {
    const k = currentIssueKey();
    if (!k) {
      return;
    }
    btn.disabled = true;
    btn.textContent = "Importing…";
    chrome.runtime.sendMessage(
      { type: "importIssue", issueKey: k, source: "content" } as const,
      (_res: FromBackgroundResponse) => {
        const lastErr = chrome.runtime.lastError?.message;
        if (lastErr) {
          btn.title = lastErr;
        }
        btn.disabled = false;
        btn.textContent = "Import to Augflow";
      }
    );
  });

  document.body.appendChild(btn);
}

let routeDebounce: number | undefined;

function scheduleRefresh(): void {
  if (routeDebounce !== undefined) {
    window.clearTimeout(routeDebounce);
  }
  routeDebounce = window.setTimeout(() => {
    routeDebounce = undefined;
    injectButton();
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

hookSpaNavigation();
injectButton();
