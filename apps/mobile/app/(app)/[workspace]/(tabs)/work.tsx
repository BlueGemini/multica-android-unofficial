import { useCallback, useMemo, useState } from "react";
import { BackHandler, FlatList, Keyboard, Pressable, ScrollView, SectionList, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { BuiltInIssueStatus, Issue } from "@multica/core/types";
import { BoardCard } from "@/components/issue/board/board-card";
import { IssueRow } from "@/components/issue/issue-row";
import { IssuesLoading } from "@/components/issue/issues-loading";
import { WorkProjectPicker } from "@/components/issue/work-project-picker";
import { HeaderActions } from "@/components/ui/app-header-actions";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { IconButton } from "@/components/ui/icon-button";
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
  const wide = contentWidthFor(width, true) >= TWO_PANE_MIN_CONTENT_DP;
  const fullscreen = useLocalSearchParams<{ fullscreen?: string }>().fullscreen === "1";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showSidebar = wide && !sidebarCollapsed && !fullscreen;
  const exitFullscreen = useCallback(() => router.setParams({ fullscreen: "0" }), []);
  useFocusEffect(useCallback(() => {
    if (!fullscreen) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      exitFullscreen();
      return true;
    });
    return () => back.remove();
  }, [exitFullscreen, fullscreen]));
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

  const projectName = project?.title ?? t("work.all_projects");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={fullscreen ? ["left", "right", "bottom"] : []}>
      <Header
        title={fullscreen ? projectName : t("work.title")}
        right={fullscreen ? (
          <IconButton
            name="contract-outline"
            accessibilityLabel={t("work.exit_fullscreen")}
            testID="work-exit-fullscreen"
            onPress={exitFullscreen}
          />
        ) : <HeaderActions />}
      />
      <View className="flex-1 flex-row">
        {wide ? (
          <View
            className="w-56 border-r border-border bg-muted/20"
            style={showSidebar ? undefined : { display: "none" }}
            testID="work-project-sidebar"
          >
            <WorkProjectPicker
              value={project}
              onCollapse={() => {
                Keyboard.dismiss();
                setSidebarCollapsed(true);
              }}
              onChange={(next) => {
                if (workspaceId) useWorkProjectStore.getState().selectProject(workspaceId, next?.id ?? null);
              }}
            />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          {!fullscreen && wide ? (
            <View className="min-h-12 flex-row items-center gap-2 border-b border-border px-3">
              {sidebarCollapsed ? (
                <IconButton
                  name="chevron-forward"
                  accessibilityLabel={t("work.expand_projects")}
                  testID="work-expand-projects"
                  onPress={() => setSidebarCollapsed(false)}
                />
              ) : null}
              <Text className="flex-1 font-medium" numberOfLines={1}>{projectName}</Text>
              <IconButton
                name="expand-outline"
                accessibilityLabel={t("work.enter_fullscreen")}
                testID="work-enter-fullscreen"
                onPress={() => {
                  Keyboard.dismiss();
                  router.setParams({ fullscreen: "1" });
                }}
              />
            </View>
          ) : null}
          {!fullscreen && !wide && workspaceSlug ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("work.choose_project", { project: projectName })}
              testID="work-project-trigger"
              className="min-h-12 flex-row items-center gap-2 border-b border-border px-4 active:bg-secondary"
              onPress={() => router.push(`/${workspaceSlug}/work-projects`)}
            >
              <Ionicons name="folder-outline" size={18} color={muted} />
              <Text className="flex-1 font-medium" numberOfLines={1}>{projectName}</Text>
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
              fullscreen={fullscreen}
              refreshing={issues.isRefetching || projects.isRefetching}
              onRefresh={() => void guardedRefresh(() => Promise.all([issues.refetch(), projects.refetch()]))}
              onOpen={(issue) => {
                if (workspaceSlug) router.push(`/${workspaceSlug}/issue/${issue.id}`);
              }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

interface WorkSection {
  status: BuiltInIssueStatus;
  count: number;
  collapsed: boolean;
  data: Issue[];
}

function WorkIssues({
  issues,
  projectId,
  fullscreen,
  refreshing,
  onRefresh,
  onOpen,
}: {
  issues: Issue[];
  projectId: string | null;
  fullscreen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (issue: Issue) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const [expanded, setExpanded] = useState<Set<BuiltInIssueStatus>>(() => new Set());
  const sections = useMemo(() => workBoardSections(issues, projectId).map(({ status, issues }) => {
    const collapsed = isTerminal(status) && !expanded.has(status);
    return { key: status, status, count: issues.length, collapsed, data: collapsed ? EMPTY_ISSUES : issues };
  }), [issues, projectId, expanded]);

  const toggle = (status: BuiltInIssueStatus) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    return next;
  });

  if (fullscreen) {
    const largeFont = fontScale >= 1.5;
    return (
      <ScrollView
        horizontal
        className="flex-1"
        contentContainerClassName="gap-3 px-3 py-2"
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        testID="work-fullscreen-board"
      >
        {height > 16 ? sections.map((section) => (
          <View
            key={section.status}
            style={{ width: largeFont ? 264 : 224, height: height - 16 }}
            className="overflow-hidden rounded-lg border border-border bg-muted/20"
            testID={`work-column-${section.status}`}
          >
            <WorkGroupHeader section={section} onToggle={toggle} />
            {section.collapsed ? null : (
              <FlatList
                data={section.data}
                keyExtractor={(issue) => issue.id}
                contentContainerClassName="gap-2 p-2"
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item }) => <BoardCard issue={item} onPress={() => onOpen(item)} largeFont={largeFont} />}
              />
            )}
          </View>
        )) : null}
      </ScrollView>
    );
  }

  return (
    <SectionList<Issue, WorkSection>
      sections={sections}
      keyExtractor={(issue) => issue.id}
      stickySectionHeadersEnabled={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => <IssueRow issue={item} onPress={() => onOpen(item)} />}
      renderSectionHeader={({ section }) => <WorkGroupHeader section={section} onToggle={toggle} />}
    />
  );
}

function isTerminal(status: BuiltInIssueStatus) {
  return status === "done" || status === "cancelled";
}

function WorkGroupHeader({
  section,
  onToggle,
}: {
  section: WorkSection;
  onToggle: (status: BuiltInIssueStatus) => void;
}) {
  const { t } = useT("issues");
  const { colorScheme } = useColorScheme();
  const label = t(`work.groups.${section.status}`);
  const canCollapse = isTerminal(section.status);
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
      onPress={() => onToggle(section.status)}
    >
      {header}
    </Pressable>
  ) : <View className={className} testID={`work-group-${section.status}`}>{header}</View>;
}
