// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fishplatform.vercel.app',
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
