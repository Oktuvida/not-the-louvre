---
name: threlte-official-docs
description: Strictly official Threlte documentation skill. Use when answering Threlte questions, locating Threlte APIs, or reasoning about Threlte packages, guides, components, hooks, and docs structure. Restrict evidence to threlte.xyz docs and the official threlte/threlte repository.
---

# Threlte Official Docs

## When To Use

Use this skill whenever the task involves Threlte itself, including:

- explaining Threlte concepts or package boundaries
- finding the right official guide or API reference page
- answering questions about `@threlte/core`, `@threlte/extras`, `@threlte/gltf`,
  `@threlte/rapier`, `@threlte/theatre`, `@threlte/xr`, `@threlte/flex`, or
  `@threlte/studio`
- checking whether a behavior is documented officially
- locating the source MDX file behind a public Threlte docs page

If the task also involves `.svelte` files, use this skill together with
`svelte-code-writer`.

## Allowed Sources

You must stay inside official Threlte sources only:

- `https://threlte.xyz/docs/learn/...`
- `https://threlte.xyz/docs/reference/...`
- `https://github.com/threlte/threlte`
- official docs source files in the repo under:
  - `apps/docs/src/content/learn/...`
  - `apps/docs/src/content/reference/...`

## Forbidden Sources

Do not use these as evidence while this skill is active:

- blogs, tutorials, articles, videos, or social posts
- Discord answers, forum posts, Stack Overflow, or issue comments
- third-party code samples or examples not published by Threlte
- general Three.js guidance presented as if it were Threlte documentation

If an official source does not support the claim, say that clearly.

## Operating Rules

- Prefer Learn docs for onboarding, concepts, and guided explanations.
- Prefer Reference docs for APIs, components, hooks, helpers, and package-level
  behavior.
- Prefer public docs URLs for final citations.
- Use the official repo docs tree as an index, cross-check, and path resolver.
- Separate Threlte behavior from underlying Three.js behavior.
- Do not infer undocumented behavior from unrelated source code.
- Cite the exact official page used in the final answer whenever practical.
- If helpful, also include the official repo path for the source page.

## Workflow

1. Classify the question.
   - conceptual, onboarding, architecture -> Learn
   - API, hooks, components, packages -> Reference
2. Resolve the official page.
   - check `references/official-map.md`
   - open the public docs page when available
   - use the repo docs path if you need to confirm or locate the source file
3. Answer only from official material.
4. Cite the exact official source.
5. If no official answer exists, say the docs do not clearly document it yet.

## Response Pattern

When answering under this skill, prefer this structure:

- direct answer grounded in official docs
- package or doc section involved
- official citation URL
- optional repo source path when useful for maintainers

## Quick Routing

- Learn docs root: `https://threlte.xyz/docs/learn/getting-started/introduction`
- Core reference root:
  `https://threlte.xyz/docs/reference/core/getting-started`
- Extras reference root:
  `https://threlte.xyz/docs/reference/extras/getting-started`
- Official repo docs tree:
  `https://github.com/threlte/threlte/tree/main/apps/docs/src/content`

For the current official docs map, see `references/official-map.md`.
