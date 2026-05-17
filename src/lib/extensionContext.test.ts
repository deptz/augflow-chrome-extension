import { describe, expect, it, vi } from "vitest";
import {
  isContextInvalidatedError,
  isExtensionContextValid,
  runtimeSendMessage,
} from "./extensionContext";

describe("extensionContext", () => {
  it("detects invalidated context errors", () => {
    expect(isContextInvalidatedError(new Error("Extension context invalidated."))).toBe(true);
    expect(isContextInvalidatedError("context invalidated")).toBe(true);
    expect(isContextInvalidatedError(new Error("network error"))).toBe(false);
  });

  it("returns false when chrome.runtime.id is unavailable", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        get id() {
          throw new Error("Extension context invalidated.");
        },
        sendMessage: vi.fn(),
      },
    });
    expect(isExtensionContextValid()).toBe(false);
    expect(runtimeSendMessage({ type: "ping" })).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns true when chrome.runtime.id is present", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn((_msg: unknown, cb?: (r: unknown) => void) => {
          if (cb) {
            cb({ ok: true });
            return;
          }
          return Promise.resolve({ ok: true });
        }),
      },
    });
    expect(isExtensionContextValid()).toBe(true);
    expect(runtimeSendMessage({ type: "ping" })).toBe(true);
    vi.unstubAllGlobals();
  });
});
