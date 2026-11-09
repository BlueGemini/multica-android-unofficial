import { useState } from "react";
import { ActivityIndicator, Keyboard, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@multica/core/types";
import { ProjectPickerBody } from "@/components/issue/pickers/project-picker-body";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { projectListOptions } from "@/data/queries/projects";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useT } from "@/lib/i18n";

export function WorkProjectPicker({
  value,
  onChange,
}: {
  value: Project | null;
  onChange: (project: Project | null) => void;
}) {
  const { t } = useT("issues");
  const [query, setQuery] = useState("");
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const projects = useQuery(projectListOptions(workspaceId));
  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pb-2 pt-3">
        <Text className="text-base font-semibold">{t("navigation:routes.projects")}</Text>
        <View className="flex-row items-center gap-1">
          <TextField
            className="min-w-0 flex-1"
            accessibilityLabel={t("picker.search_projects")}
            placeholder={t("picker.search_projects")}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
            testID="work-project-search"
          />
          {query ? (
            <IconButton
              name="close-circle-outline"
              accessibilityLabel={t("work.clear_search")}
              onPress={() => setQuery("")}
            />
          ) : null}
        </View>
      </View>
      {projects.isLoading ? (
        <ActivityIndicator className="my-4" />
      ) : projects.isError && !projects.data ? (
        <View className="gap-2 px-4 py-3">
          <Text className="text-sm text-destructive">{t("work.projects_failed")}</Text>
          <Button variant="outline" onPress={() => void projects.refetch()}>
            <Text>{t("common:actions.retry")}</Text>
          </Button>
        </View>
      ) : (
        <ProjectPickerBody
          query={query}
          value={value}
          onChange={(project) => {
            Keyboard.dismiss();
            onChange(project);
          }}
          emptySelectionLabel={t("work.all_projects")}
        />
      )}
    </View>
  );
}
