// Uses made-up polity names.

import { describe, expect, it } from 'vitest';
import { pickNames } from './names.ts';
import type { AtlasName } from './names.ts';

const names: AtlasName[] = [
  { text: 'Oldland', lang: 'en', s0: 0, e0: 100 },
  { text: 'Newland', lang: 'en', s0: 100, e0: null },
  { text: 'Nouvelle-Terre', lang: 'fr', s0: 100, e0: null },
  { text: '新国', lang: 'und', s0: 100, e0: null },
];

describe('pickNames', () => {
  it('picks the name valid on that day, in the reader’s language', () => {
    expect(pickNames(names, 50, 'en')).toEqual({ primary: 'Oldland' });
    expect(pickNames(names, 150, 'fr')).toEqual({ primary: 'Nouvelle-Terre', local: '新国' });
  });

  it('falls back to English, then to the local name', () => {
    expect(pickNames(names, 150, 'ja')).toEqual({ primary: 'Newland', local: '新国' });
    expect(pickNames([{ text: '新国', lang: 'und', s0: null, e0: null }], 5, 'en')).toEqual({ primary: '新国' });
  });

  it('matches a regional language tag to its base language', () => {
    expect(pickNames(names, 150, 'fr-CA')?.primary).toBe('Nouvelle-Terre');
  });

  it('uses any name when none is dated for that day', () => {
    expect(pickNames(names.slice(0, 1), 500, 'en')?.primary).toBe('Oldland');
  });
});
