import { describe, expect, it } from "vitest";
import type { Issue } from "@multica/core/types";
import { workBoardSections } from "./work-board";

function issue(id: string, fields: Partial<Issue> = {}): Issue {
  return { id, status: "todo", ...fields } as Issue;
}

describe("team work board", () => {
  it("shows the required stages in order and keeps human, agent and unassigned tasks together", () => {
    const tasks = [
      issue("agent", { assignee_type: "agent", project_id: "p1" }),
      issue("human", { assignee_type: "member", project_id: "p2" }),
      issue("unassigned"),
    ];
    const sections = workBoardSections(tasks, null);
    expect(sections.map((s) => s.status)).toEqual([
      "backlog", "todo", "in_progress", "in_review", "blocked", "done",
    ]);
    expect(sections[1]?.issues).toEqual(tasks);
    expect(workBoardSections(tasks, "p1").flatMap((s) => s.issues)).toEqual([tasks[0]]);
  });

  it("keeps review and blocked separate, and includes completed, cancelled and custom statuses", () => {
    const sections = workBoardSections([
      issue("review", { status: "in_review" }),
      issue("blocked", { status: "blocked" }),
      issue("qa", { status: "qa", status_category: "started" }),
      issue("shipped", { status: "shipped", status_category: "done" }),
      issue("cancelled", { status: "cancelled" }),
      issue("unknown", { status: "legacy" }),
    ], null);
    expect(Object.fromEntries(sections.map((s) => [s.status, s.issues.map((i) => i.id)]))).toEqual({
      backlog: [],
      todo: ["unknown"],
      in_progress: ["qa"],
      in_review: ["review"],
      blocked: ["blocked"],
      done: ["shipped"],
      cancelled: ["cancelled"],
    });
  });
});
