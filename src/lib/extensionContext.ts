const CONTEXT_INVALIDATED = "Extension context invalidated";

/** True when this content script can still talk to the extension background. */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome.runtime.id === "string";
  } catch {
    return false;
  }
}

export function isContextInvalidatedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(CONTEXT_INVALIDATED) || msg.toLowerCase().includes("context invalidated");
}

/**
 * Sends a runtime message from a content script. Returns false when the extension
 * was reloaded and this page must be refreshed (sendMessage throws synchronously).
 */
export function runtimeSendMessage<T = unknown>(
  message: unknown,
  callback?: (response: T) => void
): boolean {
  if (!isExtensionContextValid()) {
    return false;
  }
  try {
    if (callback) {
      chrome.runtime.sendMessage(message, (response: T) => {
        callback(response);
      });
    } else {
      void chrome.runtime.sendMessage(message).catch(() => {
        /* invalidated */
      });
    }
    return true;
  } catch {
    return false;
  }
}

export function runtimeSendMessagePromise<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isExtensionContextValid()) {
      reject(new Error(CONTEXT_INVALIDATED));
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        const err = chrome.runtime.lastError?.message;
        if (err) {
          reject(new Error(err));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
