// @vitest-environment node
/**
 * Security rule T2: the native session copy is handed
 * over only after a commit and cleared synchronously, before the local
 * teardown continues, on every path that ends a session.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const native = vi.hoisted(() => ({
  enabled: true,
  setCredentials: vi.fn((c: unknown) => {
    calls.push(`set:${JSON.stringify(c)}`);
    return true;
  }),
  clearCredentials: vi.fn(() => {
    calls.push("native-clear");
  }),
  getSettings: vi.fn(() => ({ enabled: native.enabled })),
}));

vi.mock("./native", () => ({
  rbNotify: {
    setCredentials: native.setCredentials,
    clearCredentials: native.clearCredentials,
    getSettings: native.getSettings,
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async (key: string) => {
    calls.push(`keychain-delete:${key}`);
  }),
}));

const server = vi.hoisted(() => ({ baseUrl: null as string | null }));

vi.mock("@/data/server-config-store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/data/server-config-store")>();
  return { ...real, getServerBaseUrl: () => server.baseUrl };
});

import { clearNotifySession, handOverSession } from "./session";
import { clearToken } from "@/data/secure-storage";

beforeEach(() => {
  calls.length = 0;
  native.enabled = true;
  native.setCredentials.mockClear();
  native.clearCredentials.mockClear();
  server.baseUrl = "https://multica.example.ts.net:8443";
});

describe("handOverSession", () => {
  it("passes only the tailnet URL and Multica token", () => {
    expect(handOverSession("jwt")).toBe(true);
    expect(native.setCredentials).toHaveBeenCalledWith({
      baseUrl: server.baseUrl,
      token: "jwt",
    });
  });

  it("does nothing while push is off, without token or without server", () => {
    native.enabled = false;
    expect(handOverSession("jwt")).toBe(false);
    native.enabled = true;
    expect(handOverSession(null)).toBe(false);
    server.baseUrl = null;
    expect(handOverSession("jwt")).toBe(false);
    expect(native.setCredentials).not.toHaveBeenCalled();
  });
});

describe("clearing", () => {
  it("clearNotifySession clears natively", () => {
    clearNotifySession();
    expect(native.clearCredentials).toHaveBeenCalledTimes(1);
  });

  it("clearToken (logout, 401, failed restore) clears the native copy before the keychain", async () => {
    const pending = clearToken();
    // Synchronous part already done, before any await resolved.
    expect(calls[0]).toBe("native-clear");
    await pending;
    expect(calls).toEqual(["native-clear", expect.stringMatching(/^keychain-delete:/)]);
  });

  it("resetting the server configuration clears the native copy", async () => {
    const { useServerConfigStore } = await import("@/data/server-config-store");
    await useServerConfigStore.getState().clear();
    expect(calls[0]).toBe("native-clear");
  });
});
