import { describe, expect, it } from "vitest";
import de from "../locales/de/auth.json";
import en from "../locales/en/auth.json";
import zh from "../locales/zh-Hans/auth.json";

// Every key the secret-input UI (server setup, token login) reads must exist
// in all shipped languages, and no text may interpolate anything but the
// field name or a character count — never the pasted value.
const KEYS = [
  "paste",
  "paste_label",
  "paste_ok",
  "paste_empty",
  "paste_secret_rejected",
  "paste_not_token",
  "clear_clipboard",
  "clear_clipboard_hint",
] as const;

describe("secret input strings", () => {
  it("does not ship the Cloudflare setup strings", () => {
    for (const file of [de, en, zh]) expect(file.server).not.toHaveProperty("mode_cloudflare");
  });

  for (const [lang, file] of Object.entries({ de, en, "zh-Hans": zh })) {
    it(`${lang} has every key with only safe placeholders`, () => {
      const server = file.server as Record<string, string>;
      for (const key of KEYS) {
        expect(server[key], `${lang}:server.${key}`).toBeTypeOf("string");
        const vars = [...server[key]!.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]);
        for (const v of vars) expect(["field", "count"]).toContain(v);
      }
    });
  }
});
