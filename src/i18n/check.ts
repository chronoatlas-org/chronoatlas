// Checks a translation against the English catalog (Phase 5 step 10), so a language can't be
// published with a key missing, a key English doesn't have, or a placeholder lost or renamed.
// `npm test` runs it over every catalog in index.ts (i18n.test.ts); docs/translating.md explains.

/** The {placeholders} in a text, sorted. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** What's wrong with `catalog` (named `name`) compared with `reference` (English): one line each. */
export function catalogProblems(name: string, reference: Readonly<Record<string, string>>, catalog: Readonly<Record<string, string | undefined>>): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(reference)) {
    const text = catalog[key];
    if (text === undefined) problems.push(`${name}: "${key}" is missing`);
    else if (text.trim() === '') problems.push(`${name}: "${key}" is empty`);
    else if (placeholders(text).join(',') !== placeholders(reference[key]).join(',')) {
      problems.push(`${name}: "${key}" has placeholders {${placeholders(text).join('}, {')}}, but English has {${placeholders(reference[key]).join('}, {')}}`);
    }
  }
  for (const key of Object.keys(catalog)) {
    if (!(key in reference)) problems.push(`${name}: "${key}" isn't an English key (renamed or removed?)`);
  }
  return problems;
}
