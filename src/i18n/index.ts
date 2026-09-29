// The translation layer. All text the site shows goes through `t()`, so adding a language means
// adding one catalog file (see en.ts) and listing it below; no other code needs to change.
//
// This module doesn't touch the browser, so Node scripts can use it too (for example, to format
// dates in validation messages).

import { en } from './en.ts';

export type MessageKey = keyof typeof en;
export type Catalog = Partial<Record<MessageKey, string>>;

/** Languages with a catalog. Add new ones here, e.g. `ja: ja` after creating `ja.ts`. */
const CATALOGS: Record<string, Catalog> = { en };
export const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;

export function getLocale(): string {
  return currentLocale;
}

export function setLocale(locale: string): void {
  currentLocale = locale in CATALOGS ? locale : DEFAULT_LOCALE;
}

export function supportedLocales(): string[] {
  return Object.keys(CATALOGS);
}

/** Every catalog by language, for the completeness test (check.ts). */
export function catalogs(): Readonly<Record<string, Catalog>> {
  return CATALOGS;
}

/**
 * Picks the best supported language from a list in preference order (such as the browser's
 * `navigator.languages`). "ja-JP" matches a "ja" catalog. Falls back to English.
 */
export function pickLocale(preferred: readonly string[]): string {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    if (lower in CATALOGS) return lower;
    const base = lower.split('-')[0];
    if (base in CATALOGS) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Returns the text for `key` in the current language, with {placeholders} filled from `params`.
 * Missing translations fall back to English, so a partial translation never breaks the page.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = CATALOGS[currentLocale]?.[key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
