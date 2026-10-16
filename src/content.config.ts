import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

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

// One folder per project: src/content/projects/<slug>/index.md (cover image next to it).
// Same language rules as blog: one language per entry, translations share a `translationKey`.
const projects = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      status: z.enum(['building', 'shipped', 'paused']),
      stack: z.array(z.string()).default([]),
      repo: z.string().url().optional(),
      demo: z.string().url().optional(),
      cover: image().optional(),
      date: z.coerce.date(),
      lang: z.enum(['en', 'ja', 'zh']),
      featured: z.boolean().default(false),
      translationKey: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

// The public /now page: src/content/now.yaml holds a single top-level `now:` entry.
// Item text is given per language (en is required, ja / zh fall back to it). Public items only.
const localized = z.object({ en: z.string(), ja: z.string().optional(), zh: z.string().optional() });
const nowItem = z.object({
  text: localized,
  status: z.enum(['active', 'paused', 'next', 'done']),
  link: z.string().url().optional(),
});
const now = defineCollection({
  loader: file('src/content/now.yaml'),
  schema: z.object({
    updated: z.coerce.date(),
    working: z.array(nowItem).default([]),
    learning: z.array(nowItem).default([]),
    planning: z.array(nowItem).default([]),
  }),
});

export const collections = { blog, projects, now };
