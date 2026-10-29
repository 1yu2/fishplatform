import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** optional field that also accepts the empty string / null the CMS writes for a blank value */
const opt = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

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
      updated: opt(z.coerce.date()),
      summary: z.string(),
      tags: z.array(z.string()).default([]),
      lang: z.enum(['en', 'ja', 'zh']),
      /** original URL when the post was moved here from another platform */
      canonical: opt(z.string().url()),
      translationKey: opt(z.string()),
      cover: opt(image()),
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
      repo: opt(z.string().url()),
      demo: opt(z.string().url()),
      cover: opt(image()),
      date: z.coerce.date(),
      lang: z.enum(['en', 'ja', 'zh']),
      featured: z.boolean().default(false),
      // case-study facts shown on the card and the detail page
      kind: z.enum(['data', 'ai', 'engineering', 'other']).default('other'),
      role: opt(z.string()),
      period: opt(z.string()),
      impact: opt(z.string()),
      translationKey: opt(z.string()),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog, projects };
