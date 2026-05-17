import { originPermissionPattern } from "./augflowUrl";

export type PermissionResult = { ok: true } | { ok: false; error: string };

/**
 * Ensures the extension may fetch the given Augflow origin.
 * Loopback origins are pre-declared in manifest host_permissions.
 */
export async function ensureOriginPermission(baseUrl: string): Promise<PermissionResult> {
  const origin = originPermissionPattern(baseUrl);
  try {
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (has) {
      return { ok: true };
    }
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (granted) {
      return { ok: true };
    }
    return {
      ok: false,
      error: `Permission denied to access ${baseUrl}. Allow the host when prompted.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not request host permission: ${msg}` };
  }
}
