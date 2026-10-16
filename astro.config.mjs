// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://fishplatform.vercel.app',
  // Pages are pre-built by default; the few that read the Studio database (blog, learning) opt out
  // with `export const prerender = false` and run on Vercel on request.
  output: 'static',
  adapter: vercel(),
  integrations: [preact()],
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
