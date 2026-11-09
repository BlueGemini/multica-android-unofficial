import { useMemo, useState } from "react";
import { Pressable, SectionList, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { BuiltInIssueStatus, Issue } from "@multica/core/types";
import { IssueRow } from "@/components/issue/issue-row";
import { IssuesLoading } from "@/components/issue/issues-loading";
import { WorkProjectPicker } from "@/components/issue/work-project-picker";
import { HeaderActions } from "@/components/ui/app-header-actions";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Ionicons } from "@/components/ui/ionicons";
import { StatusIcon } from "@/components/ui/status-icon";
import { Text } from "@/components/ui/text";
import { issueListOptions } from "@/data/queries/issues";
import { findProject, projectListOptions } from "@/data/queries/projects";
import { useWorkProjectId, useWorkProjectStore } from "@/data/stores/work-project-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { contentWidthFor, TWO_PANE_MIN_CONTENT_DP } from "@/lib/breakpoints";
import { useT } from "@/lib/i18n";
import { guardedRefresh } from "@/lib/refresh-guard";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { workBoardSections } from "@/lib/work-board";

const EMPTY_ISSUES: Issue[] = [];

export default function WorkBoard() {
  const { t } = useT("issues");
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const showSidebar = contentWidthFor(width, true) >= TWO_PANE_MIN_CONTENT_DP;
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const workspaceSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const selectedId = useWorkProjectId(workspaceId);

  const projectsOptions = projectListOptions(workspaceId);
  const issuesOptions = issueListOptions(workspaceId);
  const projects = useQuery(projectsOptions);
  const issues = useQuery(issuesOptions);
  useRefreshOnFocus([issuesOptions.queryKey, projectsOptions.queryKey]);

  const project = findProject(projects.data ?? [], selectedId) ?? null;
  // A deleted or inaccessible project cannot keep the board filtered.
  const projectId = projects.data ? project?.id ?? null : selectedId;
  const muted = THEME[colorScheme].mutedForeground;

  return (
    <View className="flex-1 bg-background">
      <Header title={t("work.title")} right={<HeaderActions />} />
      <View className="flex-1 flex-row">
        {showSidebar ? (
          <View className="w-56 border-r border-border bg-muted/20" testID="work-project-sidebar">
            <WorkProjectPicker
              value={project}
              onChange={(next) => {
                if (workspaceId) useWorkProjectStore.getState().selectProject(workspaceId, next?.id ?? null);
              }}
            />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          {!showSidebar && workspaceSlug ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("work.choose_project", { project: project?.title ?? t("work.all_projects") })}
              testID="work-project-trigger"
              className="min-h-12 flex-row items-center gap-2 border-b border-border px-4 active:bg-secondary"
              onPress={() => router.push(`/${workspaceSlug}/work-projects`)}
            >
              <Ionicons name="folder-outline" size={18} color={muted} />
              <Text className="flex-1 font-medium" numberOfLines={1}>{project?.title ?? t("work.all_projects")}</Text>
              <Ionicons name="chevron-down" size={16} color={muted} />
            </Pressable>
          ) : null}
          {issues.isLoading ? (
            <IssuesLoading />
          ) : issues.isError && !issues.data ? (
            <View className="gap-3 px-4 py-4">
              <Text className="text-sm text-destructive">{t("work.issues_failed")}</Text>
              <Button variant="outline" onPress={() => void issues.refetch()}>
                <Text>{t("common:actions.retry")}</Text>
              </Button>
            </View>
          ) : (
            <WorkIssues
              key={`${workspaceId}:${projectId}`}
              issues={issues.data ?? EMPTY_ISSUES}
              projectId={projectId}
              refreshing={issues.isRefetching || projects.isRefetching}
              onRefresh={() => void guardedRefresh(() => Promise.all([issues.refetch(), projects.refetch()]))}
              onOpen={(issue) => {
                if (workspaceSlug) router.push(`/${workspaceSlug}/issue/${issue.id}`);
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

interface WorkSection {
  status: BuiltInIssueStatus;
  count: number;
  collapsed: boolean;
}

function WorkIssues({
  issues,
  projectId,
  refreshing,
  onRefresh,
  onOpen,
}: {
  issues: Issue[];
  projectId: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (issue: Issue) => void;
}) {
  const { t } = useT("issues");
  const { colorScheme } = useColorScheme();
  const [expanded, setExpanded] = useState<Set<BuiltInIssueStatus>>(() => new Set());
  const sections = useMemo(() => workBoardSections(issues, projectId).map(({ status, issues }) => {
    const collapsed = (status === "done" || status === "cancelled") && !expanded.has(status);
    return { key: status, status, count: issues.length, collapsed, data: collapsed ? EMPTY_ISSUES : issues };
  }), [issues, projectId, expanded]);

  return (
    <SectionList<Issue, WorkSection>
      sections={sections}
      keyExtractor={(issue) => issue.id}
      stickySectionHeadersEnabled={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => <IssueRow issue={item} onPress={() => onOpen(item)} />}
      renderSectionHeader={({ section }) => {
        const label = t(`work.groups.${section.status}`);
        const canCollapse = section.status === "done" || section.status === "cancelled";
        const header = (
          <>
            <StatusIcon status={section.status} size={16} />
            <Text className="flex-1 text-sm font-semibold">{label}</Text>
            <Text className="text-sm text-muted-foreground">{section.count}</Text>
            {canCollapse ? (
              <Ionicons
                name={section.collapsed ? "chevron-forward" : "chevron-down"}
                size={16}
                color={THEME[colorScheme].mutedForeground}
              />
            ) : null}
          </>
        );
        const className = "min-h-12 flex-row items-center gap-2 border-y border-border bg-muted/40 px-4 py-2";
        return canCollapse ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("work.group_count", { label, count: section.count })}
            accessibilityState={{ expanded: !section.collapsed }}
            testID={`work-group-${section.status}`}
            className={className}
            onPress={() => setExpanded((previous) => {
              const next = new Set(previous);
              if (next.has(section.status)) next.delete(section.status);
              else next.add(section.status);
              return next;
            })}
          >
            {header}
          </Pressable>
        ) : <View className={className} testID={`work-group-${section.status}`}>{header}</View>;
      }}
    />
  );
}
