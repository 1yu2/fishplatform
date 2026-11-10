import { describe, expect, it } from 'vitest';
// shared.tsx only imports preact/hooks (no side effects) and a type, so it loads fine in Node.
import { slugify } from '../src/studio/shared';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  A  --  B__C!! ')).toBe('a-b-c');
  });

  it('strips accents', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
  });

  it('keeps digits', () => {
    expect(slugify('Top 10 of 2026')).toBe('top-10-of-2026');
  });

  it('drops characters outside a-z0-9 (CJK titles give an empty slug)', () => {
    expect(slugify('学习笔记')).toBe('');
    expect(slugify('Astro 学习笔记 2')).toBe('astro-2');
  });

  it('caps the length at 64', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(64);
  });

  it('does not end with a hyphen after truncation', () => {
    expect(slugify(`${'a'.repeat(63)} b`)).not.toMatch(/-$/);
  });
});
