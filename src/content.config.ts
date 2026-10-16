import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One folder per post: src/content/blog/<slug>/index.md, with its images next to it.
// A post is written in one language; translations share a `translationKey`.
const blog = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      summary: z.string(),
      tags: z.array(z.string()).default([]),
      lang: z.enum(['en', 'ja', 'zh']),
      /** original URL when the post was moved here from another platform */
      canonical: z.string().url().optional(),
      translationKey: z.string().optional(),
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
