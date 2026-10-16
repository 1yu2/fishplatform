// Row shapes of the Studio tables (supabase/schema.sql).

export type Priority = 1 | 2 | 3;

export interface Todo {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  status: 'todo' | 'doing' | 'done';
  due: string | null;          // YYYY-MM-DD
  started_at: string | null;
  done_at: string | null;
  is_public: boolean;
  learning_id: string | null;
  project: string | null;
  created_at: string;
  updated_at: string;
}

export interface Learning {
  id: string;
  kind: 'repo' | 'link';
  repo: string | null;         // owner/name
  url: string | null;
  title: string;
  description: string | null;
  stars: number | null;
  language: string | null;
  importance: Priority;
  status: 'to_learn' | 'learning' | 'learned';
  notes: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  slug: string | null;
  summary: string;
  body: string;
  tags: string[];
  lang: 'en' | 'ja' | 'zh';
  status: 'private' | 'published';
  published_at: string | null;
  learning_ids: string[];
  todo_ids: string[];
  projects: string[];
  created_at: string;
  updated_at: string;
}

/** finished to-dos stay on the homepage / blog strip this long, then drop off */
export const KEEP_DONE_DAYS = 7;

export function formatStars(n: number | null | undefined): string {
  if (n == null) return '';
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** github.com/owner/name[/...] or owner/name -> owner/name */
export function parseRepo(input: string): string | null {
  const s = input.trim().replace(/\.git$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export interface RepoInfo { title: string; description: string | null; stars: number; language: string | null; url: string }

export async function fetchRepo(repo: string): Promise<RepoInfo | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return { title: j.name, description: j.description, stars: j.stargazers_count, language: j.language, url: j.html_url };
  } catch {
    return null;
  }
}
