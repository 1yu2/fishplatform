import { getCollection, type CollectionEntry } from 'astro:content';
import { htmlLang, localePath, type Lang } from '../i18n/utils';

export type Post = CollectionEntry<'blog'>;

/** published posts, newest first (drafts show up only in `astro dev`) */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (p) => import.meta.env.DEV || !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** a post lives under its own language's prefix: /blog/x/, /ja/blog/x/, /zh/blog/x/ */
export function postPath(post: Post): string {
  return localePath(post.data.lang, `/blog/${post.id}/`);
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/g;
/** ~400 CJK characters or ~220 words per minute */
export function readingMinutes(body = ''): number {
  const cjk = (body.match(CJK) || []).length;
  const words = body.replace(CJK, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(htmlLang[lang], { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}
