import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { removeLinks } from './summarize-changes.ts';

describe('removeLinks', () => {
  // Windows allows symbolic links only with Developer Mode or administrator rights, so this runs
  // elsewhere (including the automatic checks, which run on Linux).
  it.skipIf(process.platform === 'win32')('deletes symbolic links (to files and folders) from data taken from a pull request, and keeps plain files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-test-'));
    try {
      const outside = join(dir, 'outside.txt');
      writeFileSync(outside, 'not data');
      mkdirSync(join(dir, 'data', 'sources'), { recursive: true });
      writeFileSync(join(dir, 'data', 'sources', 'test-source.yaml'), 'id: test-source\n');
      symlinkSync(outside, join(dir, 'data', 'sources', 'link.yaml'));
      symlinkSync(dir, join(dir, 'data', 'folder-link'));
      expect(removeLinks(join(dir, 'data'))).toHaveLength(2);
      expect(existsSync(join(dir, 'data', 'sources', 'test-source.yaml'))).toBe(true);
      expect(existsSync(join(dir, 'data', 'sources', 'link.yaml'))).toBe(false);
      expect(existsSync(join(dir, 'data', 'folder-link'))).toBe(false);
      expect(existsSync(outside)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
