import type { ServerConfig } from "./server-config";

export type ServerProbeResult =
  | { kind: "ok"; commit: string }
  | { kind: "redirected" }
  | { kind: "not_multica" }
  | { kind: "failed"; reason: string };

/** Probe an unsaved URL without a session or the API client's 401 hook. */
export async function probeServer(config: ServerConfig): Promise<ServerProbeResult> {
  const url = `${config.baseUrl}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: controller.signal,
    });
    if ((response.status >= 300 && response.status < 400) || response.type === "opaqueredirect" ||
        response.redirected) {
      return { kind: "redirected" };
    }
    if (!response.ok) return { kind: "failed", reason: `HTTP ${response.status}` };

    const body: unknown = await response.json().catch(() => null);
    if (controller.signal.aborted) return { kind: "failed", reason: "timeout" };
    if (body && typeof body === "object" && "status" in body && body.status === "ok") {
      const commit = "commit" in body && typeof body.commit === "string" ? body.commit.slice(0, 9) : "";
      return { kind: "ok", commit };
    }
    return { kind: "not_multica" };
  } catch (err) {
    return {
      kind: "failed",
      reason: controller.signal.aborted ? "timeout" : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
