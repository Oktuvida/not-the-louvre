# Threlte Official Docs

## Structure

```text
threlte-official-docs/
  SKILL.md               # Main skill file - read this first
  AGENTS.md              # This navigation guide
  README.md              # Human-facing summary
  references/
    official-map.md      # Official docs navigation map
```

## Usage

1. Read `SKILL.md` first.
2. Use `references/official-map.md` to route to the right official docs area.
3. Cite only official Threlte docs URLs and official `threlte/threlte` repo
   paths.
4. If the task touches `.svelte` files too, pair this skill with
   `svelte-code-writer`.

## Source Boundary

Allowed:

- `https://threlte.xyz/docs/learn/...`
- `https://threlte.xyz/docs/reference/...`
- `https://github.com/threlte/threlte`
- `apps/docs/src/content/learn/...`
- `apps/docs/src/content/reference/...`

Not allowed:

- third-party tutorials or blog posts
- community Q&A, chat logs, or issue discussions as authority
- undocumented inferences from unrelated implementation files

If you cannot support a claim from an allowed source, say so directly.
