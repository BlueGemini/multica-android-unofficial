import { describe, expect, it } from "vitest";
import { serverLabel, validateServerConfig, wsUrlFor } from "./server-config";

describe("tailnet server URL", () => {
  it("preserves the HTTPS port and proxy prefix for REST and WebSocket", () => {
    const result = validateServerConfig("  multica.example.ts.net:8443/multica///?ignore=1#fragment  ");
    expect(result).toEqual({ ok: true, config: { baseUrl: "https://multica.example.ts.net:8443/multica" } });
    if (!result.ok) throw new Error("expected a valid tailnet URL");
    expect(wsUrlFor(result.config.baseUrl)).toBe("wss://multica.example.ts.net:8443/multica/ws");
    expect(serverLabel(result.config)).toBe("multica.example.ts.net:8443/multica");
  });

  it("normalizes case and a query on a bare host", () => {
    expect(validateServerConfig("HTTPS://Multica.Example.ts.net:443?unused=1")).toEqual({
      ok: true, config: { baseUrl: "https://multica.example.ts.net" },
    });
  });

  it.each([
    ["", "url_missing"],
    ["https://", "url_invalid"],
    ["https://multica.example.ts.net:65536", "url_invalid"],
    ["https://multica.example.ts.net:0", "url_invalid"],
    ["https://user:secret@multica.example.ts.net", "url_invalid"],
    ["http://multica.example.ts.net", "url_scheme"],
    ["ftp://multica.example.ts.net", "url_scheme"],
    ["https://api.multica.ai", "url_tailnet"],
    ["https://multica.example.ts.net.evil.test", "url_tailnet"],
    ["https://100.64.0.10", "url_tailnet"],
  ])("rejects %j with %s", (input, error) => {
    expect(validateServerConfig(input)).toEqual({ ok: false, error });
  });
});
