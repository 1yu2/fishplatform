import { getCollection, type CollectionEntry } from 'astro:content';
import { localePath, type Lang } from '../i18n/utils';

export type GardenItem = CollectionEntry<'garden'>;
export type GardenStatus = GardenItem['data']['status'];
export const gardenStatuses: GardenStatus[] = ['doing', 'todo', 'done'];

/** how long a finished item keeps its slot on the homepage / blog strip */
export const KEEP_DONE_DAYS = 7;

const rank: Record<GardenStatus, number> = { doing: 0, done: 1, todo: 2 };
const time = (d?: Date) => (d ? d.valueOf() : Number.POSITIVE_INFINITY);

/**
 * Strip / page order: priority first. Within a priority, growing items, then recently finished ones
 * (they keep their slot until they expire), then what's up next (soonest due first).
 */
export function sortGarden(items: GardenItem[]): GardenItem[] {
  return [...items].sort((a, b) => {
    const A = a.data, B = b.data;
    return (
      A.priority - B.priority ||
      rank[A.status] - rank[B.status] ||
      (A.status === 'done' ? time(B.done) - time(A.done) : 0) ||
      time(A.due) - time(B.due) ||
      time(A.started) - time(B.started) ||
      A.title.localeCompare(B.title)
    );
  });
}

export async function getGarden(): Promise<GardenItem[]> {
  const all = await getCollection('garden', (g) => import.meta.env.DEV || !g.data.draft);
  return sortGarden(all);
}

export function itemTitle(item: GardenItem, lang: Lang): string {
  return item.data.titles?.[lang] || item.data.title;
}

/** garden items are language-neutral, so each has a page in every language */
export function gardenPath(lang: Lang, id: string): string {
  return localePath(lang, `/garden/${id}/`);
}

export function itemHref(item: GardenItem): string | undefined {
  if (item.data.repo) return `https://github.com/${item.data.repo}`;
  return item.data.url;
}

/* ---------- GitHub repo details, fetched once per build ---------- */

export interface RepoMeta {
  stars: number;
  description: string | null;
  language: string | null;
  url: string;
}

const cache = new Map<string, Promise<RepoMeta | undefined>>();

/**
 * Stars / description / language for `owner/name`. Uses GITHUB_TOKEN when set (recommended on Vercel:
 * unauthenticated calls are limited to 60 an hour per IP). Any failure just means no details are shown.
 */
export function repoMeta(repo?: string): Promise<RepoMeta | undefined> {
  if (!repo) return Promise.resolve(undefined);
  if (!cache.has(repo)) {
    const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    cache.set(
      repo,
      fetch(`https://api.github.com/repos/${repo}`, {
        signal: ctrl.signal,
        headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
        .then(async (r) => {
          if (!r.ok) return undefined;
          const j = await r.json();
          return { stars: j.stargazers_count, description: j.description, language: j.language, url: j.html_url } as RepoMeta;
        })
        .catch(() => undefined)
        .finally(() => clearTimeout(timer)),
    );
  }
  return cache.get(repo)!;
}

export async function repoMetaFor(items: GardenItem[]): Promise<Record<string, RepoMeta | undefined>> {
  const entries = await Promise.all(items.map(async (i) => [i.id, await repoMeta(i.data.repo)] as const));
  return Object.fromEntries(entries);
}

export function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
