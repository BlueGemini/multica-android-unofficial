import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import { validateServerConfig, type ServerConfig } from "@/lib/server-config";
import { clearNotifySession } from "@/lib/notify/session";

const KEY_URL = "rb_server_url";

interface ServerConfigState {
  config: ServerConfig | null;
  isLoaded: boolean;
  load: () => Promise<ServerConfig | null>;
  save: (config: ServerConfig) => Promise<void>;
  clear: () => Promise<void>;
}

export const useServerConfigStore = create<ServerConfigState>((set) => ({
  config: null,
  isLoaded: false,

  load: async () => {
    let config: ServerConfig | null = null;
    try {
      const result = validateServerConfig(await SecureStore.getItemAsync(KEY_URL) ?? "");
      if (result.ok) config = result.config;
    } catch {
      // A SecureStore read failure falls through to server setup.
    }
    set({ config, isLoaded: true });
    return config;
  },

  save: async (config) => {
    await SecureStore.setItemAsync(KEY_URL, config.baseUrl);
    set({ config, isLoaded: true });
  },

  clear: async () => {
    clearNotifySession();
    await SecureStore.deleteItemAsync(KEY_URL);
    set({ config: null, isLoaded: true });
  },
}));

export function getServerBaseUrl(): string | null {
  return useServerConfigStore.getState().config?.baseUrl ?? null;
}

/** Self-hosted Multica serves the web UI and API from the same origin. */
export function getWebBaseUrl(): string | null {
  return getServerBaseUrl();
}
