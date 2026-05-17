export type AugflowUrlValidation =
  | { ok: true; baseUrl: string }
  | { ok: false; error: string };

export type HostKind = "loopback" | "private" | "public";

function normalizedPort(portPart: string, protocol: string): number {
  if (portPart === "") {
    return protocol === "https:" ? 443 : 80;
  }
  const n = Number(portPart);
  return Number.isFinite(n) ? n : NaN;
}

/** IPv4 private ranges and link-local. */
function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) {
    return false;
  }
  const octets = m.slice(1, 5).map((x) => Number(x));
  if (octets.some((o) => o > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  return false;
}

export function classifyHost(hostname: string): HostKind {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return "loopback";
  }
  if (isPrivateIPv4(host)) {
    return "private";
  }
  return "public";
}

/**
 * Validates configured Augflow API base URL (origin only).
 * Loopback/private: http or https, any port. Public hostnames: https only.
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

  if (url.username || url.password) {
    return { ok: false, error: "URL must not include credentials." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Use http:// or https://." };
  }

  const host = url.hostname;
  if (!host) {
    return { ok: false, error: "URL must include a host." };
  }

  const port = normalizedPort(url.port, url.protocol);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { ok: false, error: "URL has an invalid port." };
  }

  const kind = classifyHost(host);
  if (kind === "public" && url.protocol !== "https:") {
    return {
      ok: false,
      error: "Public hostnames must use https:// (TLS required).",
    };
  }

  return { ok: true, baseUrl: `${url.protocol}//${url.host}` };
}

/** Chrome host permission pattern for a validated base URL. */
export function originPermissionPattern(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/*`;
}
