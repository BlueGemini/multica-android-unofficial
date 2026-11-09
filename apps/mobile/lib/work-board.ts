import type { BuiltInIssueStatus, Issue, IssueStatusCategory } from "@multica/core/types";
import { BUILT_IN_STATUS_ORDER, isBuiltInIssueStatus, issueColumnCategory } from "./issue-status";

const categoryGroup: Record<IssueStatusCategory, BuiltInIssueStatus> = {
  unstarted: "todo",
  started: "in_progress",
  done: "done",
  closed: "cancelled",
};

/** Keep the built-in stages distinct and include custom statuses by lifecycle. */
export function workBoardSections(issues: readonly Issue[], projectId: string | null) {
  const groups = new Map(BUILT_IN_STATUS_ORDER.map((status) => [status, [] as Issue[]]));
  for (const issue of issues) {
    if (projectId !== null && issue.project_id !== projectId) continue;
    const status = isBuiltInIssueStatus(issue.status) ? issue.status : categoryGroup[issueColumnCategory(issue)];
    groups.get(status)?.push(issue);
  }
  return [...groups]
    .filter(([status, items]) => status !== "cancelled" || items.length > 0)
    .map(([status, issues]) => ({ status, issues }));
}
