import type { APIRoute } from 'astro';

// Built with each deploy, so it reports the commit that is live. agent-autoloop's delivery reads it to
// confirm a merged PR actually reached production (ops/delivery.json → health).
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? '' }), {
    headers: { 'Content-Type': 'application/json' },
  });
