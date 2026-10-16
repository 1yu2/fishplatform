import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { localePath, type Lang } from '../i18n/utils';

export type Project = CollectionEntry<'projects'>;
export type ProjectStatus = Project['data']['status'];
export const statuses: ProjectStatus[] = ['building', 'shipped', 'paused'];

/** published projects: featured first, then newest (drafts show up only in `astro dev`) */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', (p) => import.meta.env.DEV || !p.data.draft);
  return all.sort(
    (a, b) => Number(b.data.featured) - Number(a.data.featured) || b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

/** a project lives under its own language's prefix: /projects/x/, /ja/projects/x/, /zh/projects/x/ */
export function projectPath(p: Project): string {
  return localePath(p.data.lang, `/projects/${p.id}/`);
}

/** one card per project for a `lang` list: a translation in `lang` wins, then English, then whatever exists */
export function projectsFor(all: Project[], lang: Lang): Project[] {
  const groups = new Map<string, Project[]>();
  for (const p of all) {
    const k = p.data.translationKey ?? p.id;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const pick = (g: Project[]) => g.find((p) => p.data.lang === lang) ?? g.find((p) => p.data.lang === 'en') ?? g[0];
  return all.filter((p) => pick(groups.get(p.data.translationKey ?? p.id)!) === p);
}

export async function getNow() {
  const entry = await getEntry('now', 'now');
  if (!entry) throw new Error('src/content/now.yaml needs a top-level `now:` entry');
  return entry.data;
}
