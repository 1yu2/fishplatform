import { describe, expect, it } from 'vitest';
import { ui } from '../src/i18n/ui';

// Project rule: every interface string is added in all three languages at once.
const langs = ['en', 'ja', 'zh'] as const;
const dict = (l: (typeof langs)[number]) => ui[l] as Record<string, string>;

describe('i18n dictionaries', () => {
  it('covers exactly en, ja and zh', () => {
    expect(Object.keys(ui).sort()).toEqual([...langs].sort());
  });

  for (const l of ['ja', 'zh'] as const) {
    it(`${l} has exactly the same keys as en`, () => {
      const en = Object.keys(dict('en'));
      const other = Object.keys(dict(l));
      expect(en.filter((k) => !other.includes(k)), `keys missing in ${l}`).toEqual([]);
      expect(other.filter((k) => !en.includes(k)), `keys only in ${l}`).toEqual([]);
    });
  }

  for (const l of langs) {
    it(`${l} has no empty values`, () => {
      const empty = Object.entries(dict(l)).filter(([, v]) => typeof v !== 'string' || v.trim() === '');
      expect(empty.map(([k]) => k)).toEqual([]);
    });
  }

  it('uses the same {placeholders} in every language', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const mismatched: string[] = [];
    for (const [k, v] of Object.entries(dict('en'))) {
      for (const l of ['ja', 'zh'] as const) {
        const o = dict(l)[k];
        if (o !== undefined && vars(o) !== vars(v)) mismatched.push(`${l}:${k}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});
