import type { APIRoute } from 'astro';
import { langs, localePath } from '../i18n/utils';
import { getProjects, projectPath } from '../lib/projects';
import { blogEntries, cachePublic, publicLearning } from '../lib/public-data';
import { xmlEscape } from '../lib/xml';

// Rendered on request (not @astrojs/sitemap) so posts and learning items from Studio are listed too.
export const prerender = false;

const PAGES = ['/', '/about/', '/blog/', '/projects/', '/learning/'];

export const GET: APIRoute = async ({ site }) => {
  const [posts, projects, learning] = await Promise.all([blogEntries(), getProjects(), publicLearning()]);
  const urls: { path: string; lastmod?: Date }[] = [
    ...langs.flatMap((l) => PAGES.map((p) => ({ path: localePath(l, p) }))),
    ...projects.map((p) => ({ path: projectPath(p), lastmod: p.data.date })),
    ...posts.map((e) => ({ path: e.href, lastmod: e.date })),
    ...langs.flatMap((l) => learning.map((i) => ({ path: localePath(l, `/learning/${i.id}/`) }))),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${xmlEscape(new URL(u.path, site).href)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  const headers = new Headers({ 'Content-Type': 'application/xml; charset=utf-8' });
  cachePublic(headers);
  return new Response(xml, { headers });
};
