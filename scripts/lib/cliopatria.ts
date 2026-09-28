// Record IDs for Cliopatria's rows (Phase 5 decision 12). IDs are permanent once published, so
// these rules must not change for rows already imported.
//
// Cliopatria numbers years astronomically, as EDTF does: its data has a year 0 (six rows end in
// year 0, and each is followed by a row starting in year 1), so -40 is 41 BCE.

/**
 * A row's ID before duplicates are numbered: `<unit>-<year>`, with the year as four digits for
 * years 1 CE onwards (as imported since 2026-09-28) and as `<n>bce` before that, where n is the
 * year a reader sees (-40 → `41bce`, 0 → `1bce`).
 */
export function rowId(unit: string, fromYear: number): string {
  return fromYear <= 0 ? `${unit}-${1 - fromYear}bce` : `${unit}-${String(fromYear).padStart(4, '0')}`;
}

/**
 * Numbers repeated IDs in order: the first keeps its ID, and later ones get `-2`, `-3`, … (two rows
 * can share a name and a first year). The order must be stable: the import sorts rows by name and
 * first year, and keeps the file's order for ties.
 */
export function numberDuplicates(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}-${count}`;
  });
}
