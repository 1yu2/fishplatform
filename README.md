# Personal Site — NOVARA (placeholder)

A single-page personal/portfolio landing page with a WebGL particle-sphere hero,
light-lavender theme. Pure static — no build step.

## Stack
- Plain HTML/CSS/JS in one file (`index.html`)
- Three.js (r128) via cdnjs
- Google Fonts: Archivo / Hanken Grotesk / Space Mono

## Deploy
Static site. On Vercel: framework preset = "Other", no build command, output = root.
Pushing to the connected branch auto-deploys.

## Local preview
Open `index.html` in a browser, or run:
    npx serve .

## 自动交付

给 PR 打上 `deliver` 标签，由 agent-autoloop 自动审查(审查要点见 [AGENTS.md](AGENTS.md))，审查通过后在飞书确认，再等 build、合并并核实 `/health.json` 上的线上版本。配置在 `ops/delivery.json`。
