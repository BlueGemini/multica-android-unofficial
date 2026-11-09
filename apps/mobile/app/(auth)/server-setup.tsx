import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";

import { MulticaLogo } from "@/components/brand/multica-logo";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/ionicons";
import { PasteField, type PasteFieldStatus } from "@/components/ui/paste-field";
import { Text } from "@/components/ui/text";
import { useAuthStore } from "@/data/auth-store";
import { useServerConfigStore } from "@/data/server-config-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import * as Clipboard from "@/lib/clipboard";
import { clearClipboard } from "@/lib/clipboard-clear-pref";
import * as Haptics from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { cleanPasted, containsCfSecret } from "@/lib/paste-parse";
import { validateServerConfig } from "@/lib/server-config";
import { probeServer, type ServerProbeResult } from "@/lib/server-probe";
import { THEME } from "@/lib/theme";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ServerSetup() {
  usePreventScreenCapture("server-setup");
  const { t } = useT("auth");
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === "settings";
  const { colorScheme } = useColorScheme();
  const stored = useServerConfigStore((s) => s.config);
  const saveConfig = useServerConfigStore((s) => s.save);
  const clearConfig = useServerConfigStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearWorkspace = useWorkspaceStore((s) => s.clear);

  const [baseUrl, setBaseUrl] = useState(stored?.baseUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pasteStatus, setPasteStatus] = useState<PasteFieldStatus>();
  const [testResult, setTestResult] = useState<ServerProbeResult | null>(null);
  const [pending, setPending] = useState<"test" | "save" | null>(null);

  useEffect(() => {
    if (stored) setBaseUrl(stored.baseUrl);
  }, [stored]);

  const updateUrl = (text: string, pasted = false) => {
    if (containsCfSecret(text)) {
      void clearClipboard();
      setPasteStatus({ tone: "warn", text: t("server.paste_secret_rejected") });
      return;
    }
    const value = pasted ? cleanPasted(text, "url") : text;
    if (pasted && !value) {
      setPasteStatus({ tone: "warn", text: t("server.paste_empty") });
      return;
    }
    setPasteStatus(undefined);
    setBaseUrl(value);
    setTestResult(null);
    setError(null);
  };

  const onPaste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => "");
    updateUrl(text, true);
  };

  const submit = async (action: "test" | "save") => {
    const result = validateServerConfig(baseUrl);
    setTestResult(null);
    if (!result.ok) {
      setError(t(`server.error_${result.error}`));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPending(action);
    setError(null);
    try {
      const response = await probeServer(result.config);
      setTestResult(response);
      if (response.kind === "ok" && action === "save") {
        if (stored?.baseUrl !== result.config.baseUrl && user) {
          await clearWorkspace();
          await logout();
        }
        await saveConfig(result.config);
        if (fromSettings && useAuthStore.getState().user) router.back();
        else router.replace("/");
      }
      void Haptics.notificationAsync(response.kind === "ok"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error);
    } catch {
      setError(t("server.save_failed"));
    } finally {
      setPending(null);
    }
  };

  const onForget = () => {
    Alert.alert(t("server.forget_confirm_title"), t("server.forget_confirm_body"), [
      { text: t("common:actions.cancel"), style: "cancel" },
      {
        text: t("server.forget"),
        style: "destructive",
        onPress: async () => {
          await clearWorkspace();
          await logout();
          await clearConfig();
          updateUrl("");
          if (fromSettings) router.replace("/server-setup");
        },
      },
    ]);
  };

  const busy = pending !== null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-6 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center">
            {fromSettings ? (
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.cancel")}
                className="pr-3"
              >
                <Ionicons name="chevron-back" size={24} color={THEME[colorScheme].mutedForeground} />
              </Pressable>
            ) : null}
            <View className="flex-1 items-center gap-3">
              <MulticaLogo size={32} />
              <Text className="text-2xl font-semibold text-foreground">{t("server.title")}</Text>
              <Text className="text-sm text-muted-foreground text-center">{t("server.subtitle")}</Text>
            </View>
            {fromSettings ? <View className="w-9" /> : null}
          </View>

          <View className="gap-2">
            <Text className="text-xs uppercase tracking-wider text-muted-foreground px-1">
              {t("server.url_label")}
            </Text>
            <PasteField
              testID="server-url"
              pasteText={t("server.paste")}
              pasteLabel={t("server.paste_label", { field: t("server.url_label") })}
              onPaste={() => void onPaste()}
              status={pasteStatus}
              disabled={busy}
              accessibilityLabel={t("server.url_label")}
              placeholder={t("server.url_placeholder")}
              value={baseUrl}
              onChangeText={updateUrl}
              keyboardType="url"
              invalid={error !== null}
              returnKeyType="done"
            />
            {error ? <Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text> : null}
            {testResult ? (
              <Text
                accessibilityLiveRegion="polite"
                className={testResult.kind === "ok" ? "text-sm text-foreground" : "text-sm text-destructive"}
              >
                {t(`server.test_${testResult.kind}`, {
                  commit: testResult.kind === "ok" ? testResult.commit : "",
                  reason: testResult.kind === "failed" ? testResult.reason : "",
                })}
              </Text>
            ) : null}
          </View>

          <View className="gap-3">
            <Button variant="outline" size="lg" disabled={busy} onPress={() => void submit("test")}>
              <Text>{pending === "test" ? t("server.testing") : t("server.test")}</Text>
            </Button>
            <Button size="lg" disabled={busy} onPress={() => void submit("save")}>
              <Text>{pending === "save" ? t("server.saving") : t("server.save")}</Text>
            </Button>
            {user ? (
              <Text className="text-xs text-muted-foreground text-center">{t("server.change_warning")}</Text>
            ) : null}
            {stored ? (
              <Button variant="ghost" disabled={busy} onPress={onForget}>
                <Text className="text-destructive">{t("server.forget")}</Text>
              </Button>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
