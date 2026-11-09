import { afterEach, describe, expect, it, vi } from "vitest";
import { probeServer } from "./server-probe";

const config = { baseUrl: "https://multica.example.ts.net:8443" };

afterEach(() => vi.unstubAllGlobals());

describe("server probe", () => {
  it("checks the exact HTTPS health endpoint without credentials or redirects", async () => {
    const fetch = vi.fn(async () => Response.json({ status: "ok", commit: "123456789abcdef" }));
    vi.stubGlobal("fetch", fetch);

    expect(await probeServer(config)).toEqual({ kind: "ok", commit: "123456789" });
    expect(fetch).toHaveBeenCalledWith(`${config.baseUrl}/health`, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
  });

  it("reports a redirect without probing its destination", async () => {
    const fetch = vi.fn(async () => Response.redirect("https://external.example/"));
    vi.stubGlobal("fetch", fetch);
    expect(await probeServer(config)).toEqual({ kind: "redirected" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a generic proxy or web page as a wrong endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>OK</html>")));
    expect(await probeServer(config)).toEqual({ kind: "not_multica" });
  });
});
