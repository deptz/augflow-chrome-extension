import { describe, expect, it } from "vitest";
import { validateAugflowBaseUrl } from "./augflowUrl";

describe("validateAugflowBaseUrl", () => {
  it("accepts localhost variants with allowed ports", () => {
    const def = validateAugflowBaseUrl("http://localhost:4400");
    expect(def).toEqual({ ok: true, baseUrl: "http://localhost:4400" });

    const a = validateAugflowBaseUrl("http://127.0.0.1:4400/");
    expect(a).toEqual({ ok: true, baseUrl: "http://127.0.0.1:4400" });

    const b = validateAugflowBaseUrl("localhost:5173");
    expect(b).toEqual({ ok: true, baseUrl: "http://localhost:5173" });

    const c = validateAugflowBaseUrl("http://localhost");
    expect(c).toEqual({ ok: true, baseUrl: "http://localhost" });
  });

  it("trims slashes and whitespace", () => {
    const v = validateAugflowBaseUrl("  http://127.0.0.1:4400///  ");
    expect(v).toEqual({ ok: true, baseUrl: "http://127.0.0.1:4400" });
  });

  it("rejects empty and invalid urls", () => {
    expect(validateAugflowBaseUrl("").ok).toBe(false);
    expect(validateAugflowBaseUrl(":::bad").ok).toBe(false);
  });

  it("rejects non-local hosts", () => {
    expect(validateAugflowBaseUrl("http://example.com:4400").ok).toBe(false);
  });

  it("rejects https", () => {
    expect(validateAugflowBaseUrl("https://127.0.0.1:4400").ok).toBe(false);
  });

  it("rejects disallowed ports", () => {
    expect(validateAugflowBaseUrl("http://127.0.0.1:4499").ok).toBe(false);
  });

  it("mentions allowlisted ports when port fails", () => {
    const v = validateAugflowBaseUrl("http://localhost:4499") as Extract<
      ReturnType<typeof validateAugflowBaseUrl>,
      { ok: false }
    >;
    expect(v.ok).toBe(false);
    expect(v.error).toContain("4400");
    expect(v.error).toContain("5173");
  });
});
