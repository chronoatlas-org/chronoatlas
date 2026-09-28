// Posts the data-change summary on a pull request. Run only by .github/workflows/data-summary.yml,
// after the "Build and deploy" check finishes on a pull request.
//
// How it stays safe: this runs main's own code, with permission to comment. It takes only the
// pull request's data files (YAML and JSON, which are read, never run) from GitHub's test merge of
// the pull request into its base, and writes the summary itself. So a pull request can't change
// what this code does, or what the summary says about it.
//
// It reads the event GitHub describes in GITHUB_EVENT_PATH, and uses GITHUB_TOKEN,
// GITHUB_REPOSITORY, GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_RUN_ID, and GITHUB_STEP_SUMMARY,
// all set by GitHub Actions.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { ROOT } from './lib/data.ts';
import { commentAction, findSummaryComment, pickPullRequest } from './lib/pr-comment.ts';
import type { CommentInfo, PullRequestInfo } from './lib/pr-comment.ts';
import { extractData, summarize } from './summarize-changes.ts';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set; this script runs in GitHub Actions only.`);
  return value;
};

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const REPO = env('GITHUB_REPOSITORY');

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

/** Every page of a list (100 at a time, up to `pages` pages). */
async function all<T>(path: string, pages = 10): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= pages; page++) {
    const batch = await api<T[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

async function main(): Promise<void> {
  const event = JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8'));
  const run = event.workflow_run;
  const headSha: string = run.head_sha;

  // Which pull request: GitHub names it for branches in this repository; for a fork, look among
  // the open ones. Either way, it must still be at the commit the check ran on.
  const named: { number: number }[] = run.pull_requests ?? [];
  const candidates: PullRequestInfo[] = named.length
    ? await Promise.all(named.map((p) => api<PullRequestInfo>(`/repos/${REPO}/pulls/${Number(p.number)}`)))
    : await all<PullRequestInfo>(`/repos/${REPO}/pulls?state=open`);
  const pr = pickPullRequest(candidates, headSha);
  if (!pr) {
    console.log(`No open pull request is at ${headSha} any more (a newer push?); nothing to do.`);
    return;
  }
  const number = Number(pr.number);
  const base = (pr as PullRequestInfo & { base?: { ref?: string } }).base?.ref ?? 'main';

  // GitHub's test merge of the pull request into its base: its first parent is the base, and its
  // second the pull request's latest commit. Only data/ is taken from each, as files.
  try {
    git('fetch', '--no-tags', '--depth=2', 'origin', `+refs/pull/${number}/merge:refs/remotes/pull/merge`);
  } catch {
    console.log(`Pull request ${number} has no test merge (a merge conflict?); nothing to summarize.`);
    return;
  }
  if (git('rev-parse', 'refs/remotes/pull/merge^2') !== headSha) {
    console.log(`The test merge of pull request ${number} is for another commit (a newer push?); nothing to do.`);
    return;
  }
  const baseSha = git('rev-parse', 'refs/remotes/pull/merge^1');
  const runUrl = `${env('GITHUB_SERVER_URL')}/${REPO}/actions/runs/${env('GITHUB_RUN_ID')}`;
  const { comment, full, changed, count } = summarize({
    baseDir: extractData(baseSha),
    headDir: extractData('refs/remotes/pull/merge'),
    baseName: base,
    baseLabel: baseSha.slice(0, 7),
    fullSummaryUrl: runUrl,
  });
  console.log(changed ? `Pull request ${number}: ${count} change(s) in data/.` : `Pull request ${number}: nothing in data/ changed.`);
  if (changed && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${full}\n`);

  const existing = findSummaryComment(await all<CommentInfo>(`/repos/${REPO}/issues/${number}/comments`, 30));
  const action = commentAction(existing, comment, changed);
  if (action === 'create') await api(`/repos/${REPO}/issues/${number}/comments`, { method: 'POST', body: { body: comment } });
  if (action === 'update') await api(`/repos/${REPO}/issues/comments/${existing!.id}`, { method: 'PATCH', body: { body: comment } });
  console.log({ create: 'Posted the summary.', update: 'Updated the summary.', none: 'The comment is already up to date (or not needed).' }[action]);
}

await main();
