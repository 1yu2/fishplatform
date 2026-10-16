import { defineCollection, reference, z } from 'astro:content';
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
      /** Garden items this post is about (ids from src/content/garden) */
      related: z.array(reference('garden')).default([]),
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
      translationKey: opt(z.string()),
      draft: z.boolean().default(false),
    }),
});

// The Garden: tasks, repos worth studying and links, one file per item: src/content/garden/<id>.md
// (the body is free-form notes). Everything here is public. Finished items stay on the homepage /
// blog strip for 7 days, then drop off (that check runs in the browser, so no rebuild is needed).
const garden = defineCollection({
  // id = file name (never the `slug` field the editor also writes), so post links survive renames
  loader: glob({ pattern: '*.md', base: './src/content/garden', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z
    .object({
      title: z.string(),
      /** optional per-language titles; `title` is used where one is missing */
      titles: z.object({ en: opt(z.string()), ja: opt(z.string()), zh: opt(z.string()) }).default({}),
      type: z.enum(['task', 'repo', 'link']).default('task'),
      /** for repos: owner/name; stars, description and language are fetched from GitHub at build time */
      repo: opt(z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'use owner/name')),
      url: opt(z.string().url()),
      /** 1 = most important; sorts first */
      priority: z.coerce.number().int().min(1).max(3).default(2),
      status: z.enum(['todo', 'doing', 'done']).default('todo'),
      started: opt(z.coerce.date()),
      due: opt(z.coerce.date()),
      done: opt(z.coerce.date()),
      tags: z.array(z.string()).default([]),
      /** one of my own projects this belongs to */
      project: opt(reference('projects')),
      draft: z.boolean().default(false),
    })
    .refine((d) => d.status !== 'done' || d.done, { message: 'a done item needs a `done` date', path: ['done'] }),
});

export const collections = { blog, projects, garden };
