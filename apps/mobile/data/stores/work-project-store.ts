import { create } from "zustand";

interface WorkProjectState {
  selection: { workspaceId: string; projectId: string } | null;
  selectProject: (workspaceId: string, projectId: string | null) => void;
}

export const useWorkProjectStore = create<WorkProjectState>((set) => ({
  selection: null,
  selectProject: (workspaceId, projectId) => set({
    selection: projectId ? { workspaceId, projectId } : null,
  }),
}));

export function useWorkProjectId(workspaceId: string | null) {
  return useWorkProjectStore((s) => s.selection?.workspaceId === workspaceId
    ? s.selection.projectId : null);
}
