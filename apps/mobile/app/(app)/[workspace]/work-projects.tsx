import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { WorkProjectPicker } from "@/components/issue/work-project-picker";
import { findProject, projectListOptions } from "@/data/queries/projects";
import { useWorkProjectId, useWorkProjectStore } from "@/data/stores/work-project-store";
import { useWorkspaceStore } from "@/data/workspace-store";

export default function WorkProjectsRoute() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const projectId = useWorkProjectId(workspaceId);
  const { data } = useQuery(projectListOptions(workspaceId));
  return (
    <WorkProjectPicker
      value={findProject(data ?? [], projectId) ?? null}
      onChange={(project) => {
        if (workspaceId) useWorkProjectStore.getState().selectProject(workspaceId, project?.id ?? null);
        router.back();
      }}
    />
  );
}
