/** Matches Augflow `internal/task.manualTicketKeyPattern` (PROJECT-123). */
const KEY_SEGMENT = /^[A-Za-z][A-Za-z0-9]+-\d+$/;

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

/** DOM fallback: Jira UI often exposes `data-issue-key`. */
export function extractIssueKeyFromDom(el: ParentNode = document): string | null {
  const root = el as HTMLElement & { dataset?: { issueKey?: string } };
  const typed = root?.dataset?.issueKey;
  if (typed && isValidIssueKey(typed)) {
    return typed.trim();
  }
  const holder =
    typeof el.querySelector === "function"
      ? el.querySelector("[data-issue-key]")
      : document.querySelector("[data-issue-key]");
  const key =
    holder && "getAttribute" in holder ? holder.getAttribute("data-issue-key") : null;
  if (key && isValidIssueKey(key)) {
    return key.trim();
  }
  return null;
}
