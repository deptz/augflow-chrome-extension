import { describe, expect, it } from "vitest";
import { classifyHost, validateAugflowBaseUrl } from "./augflowUrl";

describe("classifyHost", () => {
  it("classifies loopback", () => {
    expect(classifyHost("localhost")).toBe("loopback");
    expect(classifyHost("127.0.0.1")).toBe("loopback");
  });

  it("classifies private IPv4", () => {
    expect(classifyHost("192.168.1.10")).toBe("private");
    expect(classifyHost("10.0.0.5")).toBe("private");
  });

  it("classifies public hostnames", () => {
    expect(classifyHost("augflow.example.com")).toBe("public");
  });
});

describe("validateAugflowBaseUrl", () => {
  it("accepts localhost variants with any allowed port", () => {
    expect(validateAugflowBaseUrl("http://localhost:4400")).toEqual({
      ok: true,
      baseUrl: "http://localhost:4400",
    });
    expect(validateAugflowBaseUrl("http://127.0.0.1:4499")).toEqual({
      ok: true,
      baseUrl: "http://127.0.0.1:4499",
    });
    expect(validateAugflowBaseUrl("localhost:5173")).toEqual({
      ok: true,
      baseUrl: "http://localhost:5173",
    });
    expect(validateAugflowBaseUrl("https://127.0.0.1:4400")).toEqual({
      ok: true,
      baseUrl: "https://127.0.0.1:4400",
    });
  });

  it("accepts LAN http and remote https", () => {
    expect(validateAugflowBaseUrl("http://192.168.0.5:4400")).toEqual({
      ok: true,
      baseUrl: "http://192.168.0.5:4400",
    });
    expect(validateAugflowBaseUrl("https://augflow.example.com")).toEqual({
      ok: true,
      baseUrl: "https://augflow.example.com",
    });
  });

  it("trims slashes and whitespace", () => {
    expect(validateAugflowBaseUrl("  http://127.0.0.1:4400///  ")).toEqual({
      ok: true,
      baseUrl: "http://127.0.0.1:4400",
    });
  });

  it("rejects empty and invalid urls", () => {
    expect(validateAugflowBaseUrl("").ok).toBe(false);
    expect(validateAugflowBaseUrl(":::bad").ok).toBe(false);
  });

  it("rejects public host without TLS", () => {
    const v = validateAugflowBaseUrl("http://augflow.example.com:4400");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.error).toMatch(/https/i);
    }
  });

  it("rejects credentials in URL", () => {
    expect(validateAugflowBaseUrl("http://user:pass@localhost:4400").ok).toBe(false);
  });
});
