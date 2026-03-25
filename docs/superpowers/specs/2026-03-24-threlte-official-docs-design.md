# Threlte Official Docs Skill Design

## Goal

Add a repo-level skill that helps agents work with Threlte using only official
Threlte sources.

## Why

The project uses Threlte heavily, and the user wants a local skill that is
strictly grounded in official Threlte documentation rather than community
articles or inferred guidance.

## Scope

The skill will:

- live at `.agents/skills/threlte-official-docs/`
- guide agents to answer Threlte questions using only official sources
- support both public docs and the official `threlte/threlte` repository
- help agents locate the right Learn or Reference section quickly
- require explicit source citation in answers or reasoning

The skill will not:

- use third-party blogs, tutorials, forum posts, or videos
- treat general Three.js advice as Threlte guidance unless the official Threlte
  docs do so
- invent API behavior that is not documented in an official source

## Source Policy

The skill follows a strict hybrid-official policy.

Allowed sources:

- public docs under `https://threlte.xyz/docs/learn/...`
- public docs under `https://threlte.xyz/docs/reference/...`
- the official repository `https://github.com/threlte/threlte`
- official documentation source files under:
  - `apps/docs/src/content/learn/...`
  - `apps/docs/src/content/reference/...`

Disallowed sources:

- community examples not published by Threlte
- blogs, Discord answers, forum posts, Stack Overflow, and social posts
- unofficial wrappers, integrations, or code snippets presented as authority

If the answer cannot be supported by an allowed source, the skill must say so
explicitly instead of filling the gap with guesses.

## Architecture

The skill directory will contain:

```text
.agents/skills/threlte-official-docs/
  SKILL.md
  AGENTS.md
  README.md
  references/
    official-map.md
```

### File Responsibilities

- `SKILL.md`
  - entry point
  - when to use the skill
  - hard rules on allowed and forbidden sources
  - operating workflow for documentation lookup
- `AGENTS.md`
  - short navigation guide for future agents
  - points agents to `SKILL.md` first and `references/official-map.md` second
- `README.md`
  - human-facing summary of what the skill covers
- `references/official-map.md`
  - curated map of the official docs information architecture
  - pairs public doc areas with their repo source directories or files

## Documentation Map

The initial map should cover the most important official entry points confirmed
in the Threlte docs and repo:

- Learn
  - `getting-started`
    - `introduction`
    - `installation`
    - `your-first-scene`
  - `basics`
  - `advanced`
  - `more`
- Reference
  - `core`
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
  - `extras`
  - `gltf`
  - `rapier`
  - `theatre`
  - `xr`
  - `flex`
  - `studio`

This map is intentionally structural rather than encyclopedic. Its job is to
route the agent to the right official source quickly.

## Usage Workflow

When the skill is invoked, the expected workflow is:

1. Classify the user request.
   - onboarding or conceptual topics -> search Learn docs first
   - API, hooks, components, plugins, or package behavior -> search Reference
     docs first
2. Resolve the official source.
   - prefer the public docs URL when the page is available there
   - use the repository docs source as an index, cross-check, or fallback when
     locating the exact page
3. Answer from the official source only.
   - mention the exact Threlte package when relevant, such as `@threlte/core`
     or `@threlte/extras`
   - separate Threlte behavior from underlying Three.js behavior
4. Cite the source used.
   - include the exact official URL and, when useful, the official repo path
5. Handle unknowns safely.
   - if no official source supports the claim, say the docs do not currently
     confirm it

## Behavior Rules

The skill should enforce these non-negotiable rules:

- Never answer with non-official guidance when acting under this skill.
- Never cite community material as evidence.
- Never collapse Three.js guidance into Threlte guidance without saying which
  layer owns the behavior.
- Prefer Threlte Learn docs for teaching and orientation.
- Prefer Threlte Reference docs for precise API answers.
- Use repo paths to locate and verify documentation source, not as license to
  inspect unrelated code and infer undocumented behavior.

## Error Handling

If an agent cannot find an official answer, it should respond in one of these
ways:

- say the topic is not clearly documented in official Threlte docs yet
- point to the closest official section that may still help
- distinguish clearly between documented fact and a possible implementation idea
  if the user asks for guidance beyond the docs

This avoids overstating certainty and keeps the skill aligned with its strict
source policy.

## Testing And Validation

This change is documentation and skill authoring, not runtime code. Validation
for the implementation phase should focus on:

- file placement matching the existing `.agents/skills/` conventions
- instructions being internally consistent
- all referenced sources being official Threlte URLs or official repo paths
- the skill being practical enough for agents to use without pulling in
  third-party material

## Implementation Notes

- Keep the skill concise and operational.
- Prefer clear checklists and source boundaries over long prose.
- Use repo-relative paths so future agents can click directly into local files.
- Preserve consistency with the existing skill structure already used in this
  repository.

## Open Questions

- None for the initial version. The approved direction is `hybrid
  strict-official`.
