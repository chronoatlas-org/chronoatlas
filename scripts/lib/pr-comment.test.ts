import { describe, expect, it } from 'vitest';
import { BOT_LOGIN, commentAction, findSummaryComment, pickPullRequest } from './pr-comment.ts';
import { SUMMARY_MARKER } from './summary.ts';

describe('pickPullRequest', () => {
  it('picks the open pull request still at the commit the check ran on', () => {
    const prs = [
      { number: 1, state: 'closed', head: { sha: 'abc' } },
      { number: 2, state: 'open', head: { sha: 'def' } },
      { number: 3, state: 'open', head: { sha: 'abc' } },
    ];
    expect(pickPullRequest(prs, 'abc')?.number).toBe(3);
    expect(pickPullRequest(prs, 'zzz')).toBeUndefined();
  });
});

describe('findSummaryComment', () => {
  it('finds only the workflow’s own comment with the marker, not a copy by someone else', () => {
    const comments = [
      { id: 1, user: { login: 'someone' }, body: `${SUMMARY_MARKER}\nfake` },
      { id: 2, user: { login: BOT_LOGIN }, body: 'another bot comment' },
      { id: 3, user: { login: BOT_LOGIN }, body: `${SUMMARY_MARKER}\nreal` },
    ];
    expect(findSummaryComment(comments)?.id).toBe(3);
    expect(findSummaryComment([])).toBeUndefined();
  });
});

describe('commentAction', () => {
  it('posts only when data/ changed, and updates our comment whenever the summary differs', () => {
    expect(commentAction(undefined, 'new', true)).toBe('create');
    expect(commentAction(undefined, 'nothing changed', false)).toBe('none');
    expect(commentAction({ id: 1, user: { login: BOT_LOGIN }, body: 'old' }, 'new', true)).toBe('update');
    expect(commentAction({ id: 1, user: { login: BOT_LOGIN }, body: 'old' }, 'nothing changed', false)).toBe('update');
    expect(commentAction({ id: 1, user: { login: BOT_LOGIN }, body: 'same\n' }, 'same', true)).toBe('none');
  });
});
