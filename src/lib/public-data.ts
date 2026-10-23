// Server-side reads for public pages: only public / published rows are visible to the anon client.
import { sizeDiagramImages } from './diagram';
import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';
import { publicClient } from './supabase';
import type { Learning, Note, Todo } from './studio-types';
import { localePath, type Lang } from '../i18n/utils';
import { getPosts, postPath, readingMinutes } from './posts';

export async function publishedNotes(): Promise<Note[]> {
  const sb = publicClient();
  if (!sb) return [];
  const { data, error } = await sb.from('notes').select('*').eq('status', 'published').order('published_at', { ascending: false });
  if (error) console.error('[notes]', error.message);
  return (data as Note[]) ?? [];
}

export async function publicLearning(): Promise<Learning[]> {
  const sb = publicClient();
  if (!sb) return [];
  const { data, error } = await sb.from('learning').select('*').eq('is_public', true);
  if (error) console.error('[learning]', error.message);
  const order = { learning: 0, to_learn: 1, learned: 2 };
  return ((data as Learning[]) ?? []).sort((a, b) => order[a.status] - order[b.status] || a.importance - b.importance || a.title.localeCompare(b.title));
}

export async function learningItem(id: string): Promise<Learning | null> {
  const sb = publicClient();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from('learning').select('*').eq('id', id).eq('is_public', true).maybeSingle();
  return (data as Learning) ?? null;
}

export async function publicTodosFor(ids: { learningId?: string; todoIds?: string[] }): Promise<Todo[]> {
  const sb = publicClient();
  if (!sb) return [];
  let q = sb.from('todos').select('*').eq('is_public', true);
  if (ids.learningId) q = q.eq('learning_id', ids.learningId);
  if (ids.todoIds) { if (!ids.todoIds.length) return []; q = q.in('id', ids.todoIds); }
  const { data } = await q;
  return (data as Todo[]) ?? [];
}

export async function learningByIds(ids: string[]): Promise<Learning[]> {
  const sb = publicClient();
  if (!sb || !ids.length) return [];
  const { data } = await sb.from('learning').select('*').eq('is_public', true).in('id', ids);
  return (data as Learning[]) ?? [];
}

export function notePath(n: Pick<Note, 'lang' | 'slug'>): string {
  return localePath(n.lang, `/blog/${n.slug}/`);
}

/* ---------- one list for the blog: Markdown posts in the repo + notes published from Studio ---------- */

export interface BlogEntry {
  source: 'file' | 'studio';
  slug: string;
  title: string;
  summary: string;
  date: Date;
  tags: string[];
  lang: Lang;
  href: string;
  minutes: number;
}

export async function blogEntries(): Promise<BlogEntry[]> {
  const [posts, notes] = await Promise.all([getPosts(), publishedNotes()]);
  const files: BlogEntry[] = posts.map((p) => ({
    source: 'file', slug: p.id, title: p.data.title, summary: p.data.summary, date: p.data.date, tags: p.data.tags,
    lang: p.data.lang, href: postPath(p), minutes: readingMinutes(p.body),
  }));
  const taken = new Set(files.map((f) => `${f.lang}/${f.slug}`));
  const studio: BlogEntry[] = notes
    .filter((n) => n.slug && !taken.has(`${n.lang}/${n.slug}`))
    .map((n) => ({
      source: 'studio', slug: n.slug!, title: n.title, summary: n.summary, date: new Date(n.published_at ?? n.created_at), tags: n.tags,
      lang: n.lang, href: notePath(n), minutes: readingMinutes(n.body),
    }));
  return [...files, ...studio].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

/* ---------- Markdown from Studio, rendered with the same pipeline as the file posts ---------- */

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;
export async function renderMarkdown(md: string): Promise<{ html: string; headings: MarkdownHeading[] }> {
  processor ??= createMarkdownProcessor({ shikiConfig: { theme: 'github-light' } });
  const { code, metadata } = await (await processor).render(md);
  return { html: sizeDiagramImages(code), headings: metadata.headings };
}

/** short CDN cache for server-rendered pages: new posts show up within a minute */
export function cachePublic(headers: Headers) {
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
}
