/** Matches Augflow `internal/task.manualTicketKeyPattern` (PROJECT-123). */
const KEY_SEGMENT = /^[A-Za-z][A-Za-z0-9]+-\d+$/;
const KEY_IN_TEXT = /\b([A-Za-z][A-Za-z0-9]+-\d+)\b/;

export function isValidIssueKey(raw: string): boolean {
  return KEY_SEGMENT.test(raw.trim());
}

/**
 * Prefer URL parsing only (no DOM). Supports common Jira Cloud URL shapes on atlassian.net.
 */
export function extractIssueKeyFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const selected = u.searchParams.get("selectedIssue")?.trim();
    if (selected && isValidIssueKey(selected)) {
      return selected;
    }

    const browseMatch = u.pathname.match(/\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)(?:\/|$)/);
    if (browseMatch?.[1]) {
      return browseMatch[1];
    }

    const issuesMatch = u.pathname.match(/\/issues\/([A-Za-z][A-Za-z0-9]+-\d+)(?:\/|$)/i);
    if (issuesMatch?.[1]) {
      return issuesMatch[1];
    }

    const issueMatch = u.pathname.match(/\/issue\/([A-Za-z][A-Za-z0-9]+-\d+)(?:\/|$)/i);
    if (issueMatch?.[1]) {
      return issueMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

function keyFromElement(el: Element | null | undefined): string | null {
  if (!el) {
    return null;
  }
  if (el instanceof HTMLElement && el.dataset.issueKey && isValidIssueKey(el.dataset.issueKey)) {
    return el.dataset.issueKey.trim();
  }
  const attr = el.getAttribute?.("data-issue-key");
  if (attr && isValidIssueKey(attr)) {
    return attr.trim();
  }
  const href = el.getAttribute?.("href");
  if (href) {
    const fromHref = extractIssueKeyFromUrl(
      href.startsWith("http") ? href : `https://x.atlassian.net${href.startsWith("/") ? href : `/${href}`}`
    );
    if (fromHref) {
      return fromHref;
    }
  }
  const text = (el.textContent ?? "").trim();
  const m = KEY_IN_TEXT.exec(text);
  if (m?.[1] && isValidIssueKey(m[1])) {
    return m[1];
  }
  return null;
}

function searchScope(root: ParentNode): string | null {
  const typed = keyFromElement(root as Element);
  if (typed) {
    return typed;
  }

  const holder =
    typeof root.querySelector === "function"
      ? root.querySelector("[data-issue-key]")
      : null;
  const fromHolder = keyFromElement(holder);
  if (fromHolder) {
    return fromHolder;
  }

  const browseLink =
    typeof root.querySelector === "function"
      ? root.querySelector('a[href*="/browse/"]')
      : null;
  const fromBrowse = keyFromElement(browseLink);
  if (fromBrowse) {
    return fromBrowse;
  }

  const issueKeyEl =
    typeof root.querySelector === "function"
      ? root.querySelector('[id^="issuekey-"], [data-testid*="issue.views"]')
      : null;
  const fromId = keyFromElement(issueKeyEl);
  if (fromId) {
    return fromId;
  }

  return null;
}

/** DOM fallback: Jira UI often exposes `data-issue-key` or issue links in modals. */
export function extractIssueKeyFromDom(el: ParentNode = document): string | null {
  if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
    const dialogs = document.querySelectorAll('[role="dialog"], [data-testid*="issue-modal"]');
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const inDialog = searchScope(dialogs[i]!);
      if (inDialog) {
        return inDialog;
      }
    }
  }

  return searchScope(el);
}

/** URL first, then DOM (for content script). */
export function resolveIssueKey(href: string, root: ParentNode = document): string | null {
  return extractIssueKeyFromUrl(href) ?? extractIssueKeyFromDom(root);
}
