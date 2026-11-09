import { getServerBaseUrl } from "@/data/server-config-store";
import { rbNotify } from "./native";

/** Pass only the committed Multica session to the background service. */
export function handOverSession(token: string | null | undefined): boolean {
  if (!token || !rbNotify.getSettings().enabled) return false;
  const baseUrl = getServerBaseUrl();
  return baseUrl ? rbNotify.setCredentials({ baseUrl, token }) : false;
}

/** Synchronous: when this returns, the native copy and the service are gone. */
export function clearNotifySession(): void {
  rbNotify.clearCredentials();
}
