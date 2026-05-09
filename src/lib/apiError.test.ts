import { describe, expect, it } from "vitest";
import { parseApiErrorBody } from "./apiError";

describe("parseApiErrorBody", () => {
  it("prefers message field", () => {
    expect(
      parseApiErrorBody(JSON.stringify({ error: "Bad Request", message: "JIRA not configured" }))
    ).toBe("JIRA not configured");
  });

  it("falls back to error field", () => {
    expect(parseApiErrorBody(JSON.stringify({ error: "Conflict" }))).toBe("Conflict");
  });

  it("truncates opaque text", () => {
    const long = "x".repeat(600);
    expect(parseApiErrorBody(long).length).toBeLessThanOrEqual(500);
  });

  it("returns default for empty opaque body", () => {
    expect(parseApiErrorBody("")).toBe("Request failed");
  });

  it("handles non-json", () => {
    expect(parseApiErrorBody("plain")).toBe("plain");
  });
});
