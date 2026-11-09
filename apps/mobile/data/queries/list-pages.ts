/**
 * Paged `GET /api/issues` for the flat issue lists. The server
 * returns at most 100 issues per request; a workspace with many done
 * issues pushed open ones past that cap (done issues sort first by
 * position), so the board's Backlog column lost cards. The lists now load
 * page by page with `offset` until the server `total`. Personal lists retain
 * their existing cap; the team board reads the entire workspace. The cache shape stays a flat `Issue[]`, so
 * the WS updaters and mutations keep patching the same keys.
 */
import type { Issue, ListIssuesParams, ListIssuesResponse } from "@multica/core/types";
import { api } from "@/data/api";
import { LIST_ISSUES_LIMIT, LIST_ISSUES_MAX_PAGES } from "@/lib/list-cap";

/**
 * Loads the first page, then the remaining pages in bounded parallel batches. Issues are de-duplicated by id: a position change between two
 * page requests can move an issue onto the next page as well.
 */
export async function listIssuePages(
  params: ListIssuesParams,
  opts?: { signal?: AbortSignal },
  maxPages = LIST_ISSUES_MAX_PAGES,
): Promise<ListIssuesResponse> {
  const first = await api.listIssues({ ...params, limit: LIST_ISSUES_LIMIT }, opts);
  const pages = Math.min(Math.ceil(first.total / LIST_ISSUES_LIMIT), maxPages);
  // A short first page is complete, also when an old server sends no total.
  if (pages <= 1 || first.issues.length < LIST_ISSUES_LIMIT) return first;
  const byId = new Map(first.issues.map((issue) => [issue.id, issue]));
  const batchSize = LIST_ISSUES_MAX_PAGES - 1;
  for (let offsetPage = 1; offsetPage < pages; offsetPage += batchSize) {
    if (opts?.signal?.aborted) throw new Error("Issue list request aborted");
    const batch = await Promise.all(
      Array.from({ length: Math.min(batchSize, pages - offsetPage) }, (_, i) =>
        api.listIssues({
          ...params,
          limit: LIST_ISSUES_LIMIT,
          offset: (offsetPage + i) * LIST_ISSUES_LIMIT,
        }, opts),
      ),
    );
    for (const page of batch) {
      for (const issue of page.issues) {
        if (!byId.has(issue.id)) byId.set(issue.id, issue);
      }
    }
  }
  const issues = [...byId.values()];
  return { issues, total: first.total };
}
