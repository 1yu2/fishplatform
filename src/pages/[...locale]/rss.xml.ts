import type { APIRoute } from 'astro';
import { langFromParam, localePath, useTranslations } from '../../i18n/utils';
import { blogEntries, cachePublic } from '../../lib/public-data';
import { xmlEscape } from '../../lib/xml';

// One feed per interface language; like the blog list, it carries every post (repo files + Studio notes).
export const prerender = false;

export const GET: APIRoute = async ({ params, site, rewrite }) => {
  const lang = langFromParam(params.locale);
  if (!lang) return rewrite('/404');
  const t = useTranslations(lang);
  const base = site!;
  const items = (await blogEntries()).slice(0, 50).map((e) => {
    const url = new URL(e.href, base).href;
    return `<item><title>${xmlEscape(e.title)}</title><link>${url}</link><guid>${url}</guid>`
      + `<pubDate>${e.date.toUTCString()}</pubDate>`
      + (e.summary ? `<description>${xmlEscape(e.summary)}</description>` : '')
      + e.tags.map((tag) => `<category>${xmlEscape(tag)}</category>`).join('')
      + `</item>`;
  });
  const self = new URL(localePath(lang, '/rss.xml'), base).href;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${xmlEscape(t('meta.rss'))}</title><link>${new URL(localePath(lang, '/blog/'), base).href}</link>
<description>${xmlEscape(t('meta.blogDesc'))}</description><language>${lang}</language>
<atom:link href="${self}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel></rss>`;
  const headers = new Headers({ 'Content-Type': 'application/rss+xml; charset=utf-8' });
  cachePublic(headers);
  return new Response(xml, { headers });
};
