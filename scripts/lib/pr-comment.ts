// Decisions for posting the data-change summary on a pull request (scripts/post-summary.ts), kept
// apart from the GitHub calls so they can be tested.

import { SUMMARY_MARKER } from './summary.ts';

/** The account GitHub Actions posts as, with the workflow's own token. */
export const BOT_LOGIN = 'github-actions[bot]';

export interface PullRequestInfo {
  number: number;
  state: string;
  head: { sha: string };
}

export interface CommentInfo {
  id: number;
  user: { login: string } | null;
  body?: string;
}

/**
 * The open pull request whose latest commit is the one the check ran on. A pull request that has
 * moved on since (a newer push) isn't picked: the newer push's own run will summarize it.
 */
export function pickPullRequest<T extends PullRequestInfo>(candidates: readonly T[], headSha: string): T | undefined {
  return candidates.find((pr) => pr.state === 'open' && pr.head.sha === headSha);
}

/** Our earlier summary comment on the pull request: posted by the workflow, starting with the marker. */
export function findSummaryComment<T extends CommentInfo>(comments: readonly T[]): T | undefined {
  return comments.find((c) => c.user?.login === BOT_LOGIN && (c.body ?? '').startsWith(SUMMARY_MARKER));
}

/**
 * What to do with the comment: update ours when the summary changed (including to "no longer
 * changes data/"), post a new one only when the pull request changes data/, or leave things be.
 */
export function commentAction(existing: CommentInfo | undefined, body: string, changed: boolean): 'create' | 'update' | 'none' {
  if (existing) return existing.body?.trim() === body.trim() ? 'none' : 'update';
  return changed ? 'create' : 'none';
}
