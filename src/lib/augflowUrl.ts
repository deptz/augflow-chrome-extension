/** Allowed HTTP ports when Augflow URL host is localhost (v1 hardening). */
const ALLOWED_PORTS = new Set([80, 4400, 3000, 5173, 5174, 8080, 9000, 9090]);

export type AugflowUrlValidation =
  | { ok: true; baseUrl: string }
  | { ok: false; error: string };

function normalizedPort(portPart: string): number {
  if (portPart === "") {
    return 80;
  }
  const n = Number(portPart);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validates configured base URL: http only, localhost or 127.0.0.1, allowlisted port.
 */
export function validateAugflowBaseUrl(raw: string): AugflowUrlValidation {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return { ok: false, error: "Augflow base URL is empty." };
  }
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  } catch {
    return { ok: false, error: "Augflow base URL is not a valid URL." };
  }

  if (url.protocol !== "http:") {
    return {
      ok: false,
      error: "Use http://localhost or http://127.0.0.1 (no https in v1).",
    };
  }

  const host = url.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    return { ok: false, error: "Host must be localhost or 127.0.0.1." };
  }

  const port = normalizedPort(url.port);
  if (!Number.isFinite(port) || !ALLOWED_PORTS.has(port)) {
    return {
      ok: false,
      error: `Port must be one of: ${Array.from(ALLOWED_PORTS)
        .sort((a, b) => a - b)
        .join(", ")}.`,
    };
  }

  return { ok: true, baseUrl: `${url.protocol}//${url.host}` };
}
