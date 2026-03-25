# Official Threlte Docs Map

This file is a curated navigation map for official Threlte docs.

Use it to route a question to the correct official page before reading further.

## Canonical Sources

- Public docs root: `https://threlte.xyz/docs/learn/getting-started/introduction`
- Public reference root: `https://threlte.xyz/docs/reference/core/getting-started`
- Official repo root: `https://github.com/threlte/threlte`
- Repo docs source root: `apps/docs/src/content`

## Learn

Use Learn for conceptual guidance, onboarding, and guided explanations.

### Getting Started

- Public:
  - `https://threlte.xyz/docs/learn/getting-started/introduction`
  - `https://threlte.xyz/docs/learn/getting-started/installation`
  - `https://threlte.xyz/docs/learn/getting-started/your-first-scene`
- Repo source:
  - `apps/docs/src/content/learn/getting-started/introduction.mdx`
  - `apps/docs/src/content/learn/getting-started/installation.mdx`
  - `apps/docs/src/content/learn/getting-started/your-first-scene.mdx`

### Basics

- Public section: `https://threlte.xyz/docs/learn/basics/app-structure`
- Repo source directory: `apps/docs/src/content/learn/basics`
- Notable pages:
  - `app-structure`
  - `loading-assets`
  - `handling-events`
  - `scheduling-tasks`
  - `render-modes`
  - `disposing-objects`

### Advanced

- Public section: `https://threlte.xyz/docs/learn/advanced/plugins`
- Repo source directory: `apps/docs/src/content/learn/advanced`
- Notable pages:
  - `plugins`
  - `custom-abstractions`
  - `webgpu`
  - `migration-guides`

### More

- Public section: `https://threlte.xyz/docs/learn/more/resources`
- Repo source directory: `apps/docs/src/content/learn/more`
- Notable page:
  - `resources`

## Reference

Use Reference for package-specific APIs, components, hooks, and helpers.

### Core - `@threlte/core`

- Public root: `https://threlte.xyz/docs/reference/core/getting-started`
- Repo source directory: `apps/docs/src/content/reference/core`
- Notable pages:
  - `getting-started`
  - `canvas`
  - `t`
  - `plugins`
  - `use-loader`
  - `use-stage`
  - `use-task`
  - `use-threlte`
  - `use-threlte-user-context`
  - `utilities`

### Extras - `@threlte/extras`

- Public root: `https://threlte.xyz/docs/reference/extras/getting-started`
- Repo source directory: `apps/docs/src/content/reference/extras`
- Notable groups:
  - getting started and lifecycle
    - `getting-started`, `suspense`, `onSuspend`, `onReveal`
  - controls
    - `camera-controls`, `orbit-controls`, `trackball-controls`,
      `transform-controls`
  - audio
    - `audio`, `audio-listener`, `positional-audio`, `use-audio-listener`,
      `use-threlte-audio`
  - loading and hooks
    - `gltf`, `use-gltf`, `use-gltf-animations`, `use-texture`, `use-fbo`,
      `use-progress`, `use-suspense`, `use-cursor`, `use-gamepad`,
      `use-viewport`
  - environment and scene utilities
    - `environment`, `cube-environment`, `virtual-environment`,
      `cube-camera`, `portal`, `portal-target`, `view`, `hud`, `sky`
  - geometry and helpers
    - `backdrop-geometry`, `rounded-box-geometry`, `text-3d-geometry`,
      `mesh-line-geometry`, `bounds`, `mesh-bounds`, `decal`, `detailed`,
      `edges`, `mask`, `align`, `billboard`, `float`
  - instancing
    - `instance`, `instanced-mesh`, `instanced-meshes`, `instanced-sprite`
  - materials and textures
    - `animated-sprite-material`, `fake-glow-material`, `image-material`,
      `linear-gradient-texture`, `radial-gradient-texture`,
      `mesh-discard-material`, `mesh-line-material`,
      `mesh-refraction-material`, `points-material`, `shadow-material`,
      `uv-material`, `wireframe`
  - rendering and effects
    - `bake-shadows`, `contact-shadows`, `soft-shadows`, `csm`,
      `ascii-renderer`, `outlines`, `perf-monitor`, `sparkles`, `stars`,
      `bvh`
  - text and overlays
    - `html`, `text`, `svg`, `gizmo`, `grid`

### GLTF - `@threlte/gltf`

- Public root: `https://threlte.xyz/docs/reference/gltf/getting-started`
- Repo source directory: `apps/docs/src/content/reference/gltf`
- Notable page:
  - `getting-started`

### Rapier - `@threlte/rapier`

- Public root: `https://threlte.xyz/docs/reference/rapier/getting-started`
- Repo source directory: `apps/docs/src/content/reference/rapier`
- Notable pages:
  - `getting-started`
  - `world`
  - `rigid-body`
  - `collider`
  - `auto-colliders`
  - `collision-groups`
  - `framerate`
  - `debug`
  - `about-joints`
  - `use-rapier`
  - `use-rigid-body`
  - `use-joint`
  - `use-fixed-joint`
  - `use-prismatic-joint`
  - `use-revolute-joint`
  - `use-rope-joint`
  - `use-spherical-joint`
  - `use-physics-task`
  - `use-collision-groups`

### Theatre - `@threlte/theatre`

- Public root: `https://threlte.xyz/docs/reference/theatre/getting-started`
- Repo source directory: `apps/docs/src/content/reference/theatre`
- Notable pages:
  - `getting-started`
  - `declare`
  - `project`
  - `sheet`
  - `sheet-object`
  - `sheet-object-action`
  - `sequence`
  - `studio`
  - `sync`
  - `theatre`
  - `transform`
  - `use-sequence`
  - `use-studio`

### XR - `@threlte/xr`

- Public root: `https://threlte.xyz/docs/reference/xr/getting-started`
- Repo source directory: `apps/docs/src/content/reference/xr`
- Notable pages:
  - `getting-started`
  - `xr`
  - `controller`
  - `hand`
  - `headset`
  - `button-ar`
  - `button-vr`
  - `button-xr`
  - `pointer-controls`
  - `teleport-controls`
  - `use-controller`
  - `use-hand`
  - `use-hand-joint`
  - `use-headset`
  - `use-hit-test`
  - `use-teleport`
  - `use-xr`

### Flex - `@threlte/flex`

- Public root: `https://threlte.xyz/docs/reference/flex/getting-started`
- Repo source directory: `apps/docs/src/content/reference/flex`
- Notable pages:
  - `getting-started`
  - `flex`
  - `box`
  - `create-class-parser`
  - `tailwind-parser`
  - `use-dimensions`
  - `use-reflow`
  - `examples`

### Studio - `@threlte/studio`

- Public root: `https://threlte.xyz/docs/reference/studio/getting-started`
- Repo source directory: `apps/docs/src/content/reference/studio`
- Notable pages:
  - `getting-started`
  - `studio`
  - `authoring-extensions`
  - `deploying-to-production`
  - `static-state`
  - `use-object-selection`
  - `use-snapping`
  - `use-space`
  - `use-studio-objects-registry`
  - `use-transactions`
  - `use-transform-controls`

## Decision Guide

- "How do I start with Threlte?" -> Learn / Getting Started
- "How is a Threlte app structured?" -> Learn / Basics
- "How do plugins or abstractions work?" -> Learn / Advanced
- "What does `<T>` do?" -> Reference / Core / `t`
- "Which package owns this feature?" -> Reference package roots above
- "Where is this page in the repo?" -> matching path under
  `apps/docs/src/content/...`

## Strictness Reminder

When this skill is active:

- use only official docs and official repo docs paths
- cite the exact public docs page whenever possible
- do not fill gaps with community knowledge
