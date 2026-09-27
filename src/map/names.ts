// Choosing which of a polity's names to show for a given day and language.

export interface AtlasName {
  text: string;
  lang: string;
  /** First day the name applies (day number), or null if unknown. */
  s0: number | null;
  /** First day it no longer applies (day number), or null if ongoing or unknown. */
  e0: number | null;
}

export interface ChosenNames {
  /** In the reader's language if we have it, else English, else the local name. */
  primary: string;
  /** The local name (original script), when it differs from the primary name. */
  local?: string;
}

export function pickNames(names: readonly AtlasName[], day: number, locale: string): ChosenNames | null {
  if (names.length === 0) return null;
  const current = names.filter((n) => (n.s0 === null || n.s0 <= day) && (n.e0 === null || day < n.e0));
  const pool = current.length > 0 ? current : names;
  // Exact tag first (zh-Hant), then the base language on both sides (fr-CA finds fr).
  const inLanguage = (tag: string) => {
    const base = tag.split('-')[0];
    return pool.find((n) => n.lang === tag) ?? pool.find((n) => n.lang.split('-')[0] === base);
  };
  const primary = inLanguage(locale) ?? inLanguage('en') ?? inLanguage('und') ?? pool[0];
  const local = inLanguage('und');
  return {
    primary: primary.text,
    ...(local && local.text !== primary.text ? { local: local.text } : {}),
  };
}
