import { describe, expect, it } from "vitest";
import {
  extractIssueKeyFromDom,
  extractIssueKeyFromUrl,
  isValidIssueKey,
} from "./issueKey";

describe("isValidIssueKey", () => {
  it("accepts PROJECT-123", () => {
    expect(isValidIssueKey("PROJ-123")).toBe(true);
    expect(isValidIssueKey("A1-999")).toBe(true);
  });

  it("rejects invalid shapes", () => {
    expect(isValidIssueKey("")).toBe(false);
    expect(isValidIssueKey("PROJ")).toBe(false);
    expect(isValidIssueKey("123")).toBe(false);
    expect(isValidIssueKey("-PROJ-1")).toBe(false);
  });
});

describe("extractIssueKeyFromUrl", () => {
  it("parses browse URL", () => {
    expect(
      extractIssueKeyFromUrl(
        "https://acme.atlassian.net/jira/software/projects/ABC/boards/1?modal=detail&selectedIssue=FOO-123"
      )
    ).toBe("FOO-123");
    expect(extractIssueKeyFromUrl("https://acme.atlassian.net/browse/ABC-456")).toBe(
      "ABC-456"
    );
  });

  it("parses trailing slash browse", () => {
    expect(extractIssueKeyFromUrl("https://x.atlassian.net/browse/ZX-77/")).toBe(
      "ZX-77"
    );
  });

  it("parses selectedIssue query on board", () => {
    expect(
      extractIssueKeyFromUrl(
        "https://acme.atlassian.net/jira/software/c/projects/KAN/boards/2?selectedIssue=KAN-9"
      )
    ).toBe("KAN-9");
  });

  it("parses issues / issue segments", () => {
    expect(
      extractIssueKeyFromUrl(
        "https://acme.atlassian.net/jira/software/projects/DEV/issues/DEV-1"
      )
    ).toBe("DEV-1");
    expect(
      extractIssueKeyFromUrl("https://acme.atlassian.net/jira/core/projects/BUG/issue/BUG-2")
    ).toBe("BUG-2");
  });

  it("returns null when no key", () => {
    expect(extractIssueKeyFromUrl("https://acme.atlassian.net/wiki/home")).toBeNull();
    expect(extractIssueKeyFromUrl("not-a-url")).toBeNull();
  });

  it("prefers selectedIssue over browse-like path quirks", () => {
    expect(
      extractIssueKeyFromUrl(
        "https://x.atlassian.net/browse/AAA-1?selectedIssue=BBB-2"
      )
    ).toBe("BBB-2");
  });
});

describe("extractIssueKeyFromDom", () => {
  it("reads data-issue-key descendant", () => {
    document.body.innerHTML =
      '<div><span data-issue-key="DOM-123" id="t"></span></div>';
    expect(extractIssueKeyFromDom()).toBe("DOM-123");
  });

  it("reads dataset.issueKey from root element", () => {
    document.body.innerHTML = "";
    const el = document.createElement("div");
    el.dataset.issueKey = "EL-404";
    expect(extractIssueKeyFromDom(el)).toBe("EL-404");
  });

  it("returns null when missing", () => {
    document.body.innerHTML = "<div>nope</div>";
    expect(extractIssueKeyFromDom()).toBeNull();
  });
});
