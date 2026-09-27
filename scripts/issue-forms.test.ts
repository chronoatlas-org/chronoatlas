// Checks the GitHub issue forms in .github/ISSUE_TEMPLATE/ against the rules in GitHub's form
// schema (https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema).
// GitHub doesn't report a broken form; it just leaves it out of the "New issue" chooser.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const dir = join(import.meta.dirname, '..', '.github', 'ISSUE_TEMPLATE');
const forms = readdirSync(dir).filter((f) => f.endsWith('.yml') && f !== 'config.yml');

// Field ids that the site (or docs) pre-fill through the address. Renaming one breaks those links.
const STABLE_IDS: Record<string, string[]> = {
  'border-correction.yml': ['territory', 'date_range', 'problem', 'sources', 'view_link', 'suggested_fix', 'confirmations'],
  'missing-event.yml': ['event_name', 'date', 'location', 'why_it_matters', 'sources', 'related_territories'],
  'bug.yml': ['what_happened', 'expected', 'steps', 'view_link', 'device_browser'],
};

const TYPES = ['markdown', 'textarea', 'input', 'dropdown', 'checkboxes', 'upload'];

interface Item {
  type: string;
  id?: string;
  attributes: Record<string, unknown>;
  validations?: { required?: boolean };
}

describe('issue forms', () => {
  it('include the three forms', () => {
    expect(forms.sort()).toEqual(['border-correction.yml', 'bug.yml', 'missing-event.yml']);
  });

  for (const file of forms) {
    describe(file, () => {
      const form = parse(readFileSync(join(dir, file), 'utf8')) as {
        name: string;
        description: string;
        body: Item[];
      };

      it('has the required top-level keys', () => {
        expect(form.name.length).toBeGreaterThan(3);
        expect(form.description).toBeTruthy();
        expect(Array.isArray(form.body)).toBe(true);
      });

      it('uses valid types, ids, and labels', () => {
        const ids = new Set<string>();
        for (const item of form.body) {
          expect(TYPES).toContain(item.type);
          expect(item.attributes).toBeTypeOf('object');
          if (item.type === 'markdown') {
            expect(item.id).toBeUndefined();
            expect(item.attributes.value).toBeTypeOf('string');
            continue;
          }
          expect(item.attributes.label).toBeTypeOf('string');
          if (item.id !== undefined) {
            expect(item.id).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(ids.has(item.id), `duplicate id ${item.id}`).toBe(false);
            ids.add(item.id);
          }
        }
        expect(form.body.some((i) => i.type !== 'markdown')).toBe(true);
      });

      it('keeps its stable field ids', () => {
        const ids = form.body.map((i) => i.id);
        for (const id of STABLE_IDS[file] ?? []) expect(ids).toContain(id);
      });
    });
  }

  it('has a valid chooser config', () => {
    const config = parse(readFileSync(join(dir, 'config.yml'), 'utf8')) as {
      blank_issues_enabled: boolean;
      contact_links: { name: string; url: string; about: string }[];
    };
    expect(config.blank_issues_enabled).toBe(true);
    for (const link of config.contact_links) {
      // GitHub rejects anything but http(s) here, including mailto:.
      expect(link.url).toMatch(/^https?:\/\//);
      expect(link.name && link.about).toBeTruthy();
    }
  });
});
