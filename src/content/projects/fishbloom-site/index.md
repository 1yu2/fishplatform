---
title: Fishbloom — this site
summary: A lavender personal site where a breathing particle sphere folds into a hexagon on scroll, in English, Japanese and Chinese.
status: shipped
stack: [Astro, Three.js, GLSL, TypeScript, Vercel]
repo: https://github.com/1yu2/fishplatform
demo: https://fishplatform.vercel.app/
date: 2026-10-16
lang: en
featured: true
---

Fishbloom is my personal site and the place I try out ideas in motion and rendering. It began as a single `index.html` and became a static Astro site once it needed a blog and three languages.

## What's in it

- **Homepage:** about 5,200 particles and a wireframe icosahedron share one simplex-noise displacement. Scrolling drives a single `uMorph` uniform that turns the sphere into a hollow hexagonal ring that faces the camera.
- **Service cards:** each card has its own small three.js scene, a matte lilac glass shape with soft VSM shadows. It grows from thin lines when the card scrolls into view.
- **About page:** a peony video is keyed and colour-graded in a fragment shader, so the flower blends into the light page without a frame around it.
- **Content:** blog posts, projects and a /now page live in Markdown and YAML content collections. The interface comes in English, 日本語 and 中文.

## Notes from building it

The light theme changed more than the colours. Additive blending, the usual choice for glowing particles, washes out to white on a pale background, so the particles use normal blending and get their depth from density instead.

Deployment is plain: every push to `main` makes a Vercel build of the static output. Bigger changes go on a branch first, so they get a preview URL before they go live.
