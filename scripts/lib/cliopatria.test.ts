import { describe, expect, it } from 'vitest';
import { numberDuplicates, rowId } from './cliopatria.ts';

// Made-up unit names (Testland), not real Cliopatria rows.
describe('rowId', () => {
  it('keeps the four-digit form for years from 1 CE, as imported before', () => {
    expect(rowId('cliopatria-testland', 1937)).toBe('cliopatria-testland-1937');
    expect(rowId('cliopatria-testland', 5)).toBe('cliopatria-testland-0005');
  });

  it('writes BCE years as a reader sees them (astronomical -40 is 41 BCE, 0 is 1 BCE)', () => {
    expect(rowId('cliopatria-testland', -40)).toBe('cliopatria-testland-41bce');
    expect(rowId('cliopatria-testland', 0)).toBe('cliopatria-testland-1bce');
    expect(rowId('cliopatria-testland', -3399)).toBe('cliopatria-testland-3400bce');
  });

  it('gives IDs that follow the ID rule', () => {
    for (const year of [-3399, -40, 0, 1, 2024]) expect(rowId('cliopatria-testland', year)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('numberDuplicates', () => {
  it('numbers the second and later copies of an ID, in order', () => {
    expect(numberDuplicates(['a-1901', 'b-1901', 'a-1901', 'a-1901'])).toEqual(['a-1901', 'b-1901', 'a-1901-2', 'a-1901-3']);
  });
});
