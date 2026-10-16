---
title: Morphing a particle sphere into a hexagon with Three.js
slug: particle-sphere-to-hexagon
date: 2026-10-16
summary: How the homepage's breathing particle sphere flattens into a hollow hexagonal ring as you scroll — done entirely in the vertex shader, with one uniform driving the whole transition.
tags: [Three.js, WebGL, Animation]
lang: en
related: [three-js, hexagon-morph-polish]
---

The homepage opens on a breathing sphere of ~5,200 particles wrapped in a wireframe mesh. Scroll a little and it flattens into a hollow hexagonal ring facing the camera, then turns slowly in place. This post walks through how that works.

## Keep the morph in the shader

The tempting approach is to compute new positions in JavaScript every frame and upload them. With thousands of points that wastes the CPU and the bus. Instead, **every particle computes both of its shapes in the vertex shader** and blends between them with a single uniform:

```glsl
uniform float uMorph;   // 0 = sphere, 1 = hexagon (driven by scroll)

vec3 sphereP = sp + dir * d * uAmp;            // the noisy, breathing sphere
float m = morphAt(aSeed.y);                    // per-particle progress (see below)
vec3 p = mix(sphereP, hexPos(sp, aSeed, d, uAmp), m);
```

JavaScript only eases `uMorph` toward a scroll-based target, so wheel steps never cause jumps:

```js
morphTarget = clamp((scrollY - vh * 0.3) / (vh * 0.6), 0, 1);
morph += (morphTarget - morph) * Math.min(1, dt * 4.5);
```

## Where a particle goes on the hexagon

Each particle keeps its angle around the view axis and gets a new radius. For a pointy-top hexagon, the distance to the edge at angle `θ` is the apothem divided by the cosine of the angle to the nearest edge normal:

```glsl
float th = atan(sp.y, sp.x);
float a  = mod(th + 0.5235988, 1.0471976) - 0.5235988;   // angle to nearest edge normal
float rim = 1.98 * 0.8660254 / cos(a);                    // hexagon, circumradius 1.98
```

Particles are spread across a band from radius 1.22 out to that rim, biased toward the rim so the outline reads crisply. About 28% of them go to a separate, rounder **inner ring** around the hollow centre, which gives the second layer you can see in the reference animation.

## Stagger, so it doesn't move like one rigid block

If every particle used `uMorph` directly, the whole cloud would slide in lockstep. A per-particle random seed delays each one a little:

```glsl
float morphAt(float stagger) {
  return smoothstep(stagger * 0.35, stagger * 0.35 + 0.65, uMorph);
}
```

The wireframe uses the same functions, but with **smooth noise instead of random seeds**, so neighbouring vertices stay together and the web doesn't shatter into long spikes.

## Small things that mattered

- **Spin hand-off.** The sphere spins around Y, but a hexagon facing the camera would turn edge-on. So the Y spin fades out with the morph while an in-plane rotation fades in.
- **Hiding spokes.** Triangles near the sphere's poles fan out across the hole when flattened. Fading vertices by how close they sit to the view axis removes them.
- **Light background.** On a light page, additive blending washes everything to white, so the particles use normal blending.

The result is one uniform, two shapes per particle, and a transition that stays smooth however fast you scroll.
