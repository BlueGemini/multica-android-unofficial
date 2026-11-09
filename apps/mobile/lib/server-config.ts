/** The HTTPS base URL for a Multica server on the user's tailnet. */
export interface ServerConfig {
  baseUrl: string;
}

export type ServerConfigError = "url_missing" | "url_invalid" | "url_scheme" | "url_tailnet";

type ValidationResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; error: ServerConfigError };

export function validateServerConfig(input: string): ValidationResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "url_missing" };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https:\/\//i.test(raw)) {
    return { ok: false, error: "url_scheme" };
  }

  // React Native's URL polyfill does not reliably split the authority and
  // query. Accept just an HTTPS authority and optional proxy prefix here.
  const endpoint = raw.replace(/^https:\/\//i, "").split(/[?#]/, 1)[0]!;
  const match = /^([a-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s\\]*)?$/i.exec(endpoint);
  if (!match) return { ok: false, error: "url_invalid" };

  const hostname = match[1]!.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.ts\.net$/.test(hostname)) {
    return { ok: false, error: "url_tailnet" };
  }
  const port = Number(match[2] ?? 443);
  if (port < 1 || port > 65535) return { ok: false, error: "url_invalid" };
  const prefix = (match[3] ?? "").replace(/\/+$/, "");
  const authority = port === 443 ? hostname : `${hostname}:${port}`;
  return { ok: true, config: { baseUrl: `https://${authority}${prefix}` } };
}

/** Keep the explicit port and path prefix on the HTTPS origin. */
export function wsUrlFor(baseUrl: string): string {
  return `wss://${baseUrl.slice("https://".length)}/ws`;
}

export function serverLabel(config: ServerConfig | null): string {
  return config?.baseUrl.replace(/^https:\/\//, "") ?? "";
}
