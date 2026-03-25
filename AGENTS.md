## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, drizzle, better-auth

---

# AGENTS.md

## Manifesto

```
If it cannot be tested, I do not trust it enough.
If it can be automated, I do not want to babysit it manually.
If it is not reproducible, it is a future bug wearing a disguise.
```

---

## Development Methodology

### Test-Driven Development (Test-First)

Every behavior change starts with a failing test:

1. **Red** — Write a test that describes the expected behavior. Run it; it must fail.
2. **Green** — Write the minimum code to make the test pass.
3. **Refactor** — Clean up while keeping the tests green.

Do not skip the red step. A test that has never been seen failing proves nothing.

### Automated Quality Gates

All quality checks run as scripts — never rely on manual review alone.

| Script | What it checks |
| --- | --- |
| `bun run format` | Code formatting (Prettier) |
| `bun run lint` | Lint rules (ESLint + Prettier check) |
| `bun run check` | Type-checking (svelte-check + TypeScript) |
| `bun run test:unit` | Unit & component tests (Vitest) |
| `bun run test:e2e` | End-to-end tests (Playwright) |
| `bun run test` | Unit + e2e combined |

Before pushing code, all of the above must pass. Prefer running them in order: format → lint → check → test.

### Reproducibility (Everything-as-Code)

Local development must be reproducible from a clean clone:

- **Infrastructure**: `compose.yaml` defines all services. `bun run db:start` brings them up.
- **Dependencies**: `bun install` from root. Lockfile is committed.
- **Environment**: `.env.example` documents every required variable.
- **Schema**: Drizzle migrations define the database state (see below).
- **CI**: Same scripts locally and in CI — no hidden steps.

---

## Database Conventions

This project follows a **code-first** approach with Drizzle ORM.

### Schema Changes (Always Migrated)

All structural changes to the database go through migrations:

1. Edit the schema in `apps/web/src/lib/server/db/schema.ts`.
2. Generate a migration: `bun run db:generate`.
3. Apply it: `bun run db:migrate`.

Never modify the database schema by hand. The migration history is the source of truth.

### Data Migrations

- **Small and deterministic** (rename, backfill a column with a derived value, restructure existing rows): include them as a migration.
- **Seed data, default inserts, or non-deterministic bulk operations**: handle outside of migrations (seed scripts, application logic, etc.).

The threshold: if the data change is tightly coupled to a schema change and can be expressed as a single, idempotent SQL statement, it belongs in a migration. Otherwise, it does not.

### Auth Schema

Better Auth owns its schema. Regenerate it when auth config changes:

```bash
bun run auth:schema
```

This outputs to `apps/web/src/lib/server/db/auth.schema.ts`. Do not edit that file manually.

---

## Commit Convention

This repository uses Angular-style Conventional Commits with a required emoji prefix.

### Format

```text
<emoji> <type>(scope): <description>
<emoji> <type>: <description>
<emoji> <type>(scope)!: <description>
```

### Rules

- Match the emoji with the commit type.
- Keep the type lowercase.
- Use `scope` when it adds clarity.
- Keep the description short, imperative, and without a trailing period.
- Use `!` for breaking changes and explain the impact in the body or footer.

### Types

| Emoji | Type | Use |
| --- | --- | --- |
| ✨ | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| 📝 | `docs` | Documentation changes |
| 💄 | `style` | Formatting or visual-only changes |
| ♻️ | `refactor` | Internal refactor with no behavior change |
| ⚡ | `perf` | Performance improvement |
| ✅ | `test` | Tests added or updated |
| 🏗️ | `build` | Build system or dependency changes |
| 👷 | `ci` | CI/CD changes |
| 🧹 | `chore` | Maintenance tasks |
| ⏪ | `revert` | Revert a previous commit |

### Examples

```text
✨ feat(gallery): add artwork forking flow
🐛 fix(canvas): prevent brush offset on mobile
📝 docs(readme): update setup instructions
♻️ refactor(auth): simplify session validation
✅ test(voting): cover downvote edge cases
👷 ci: run checks on pull requests
⏪ revert: revert "✨ feat(gallery): add artwork forking flow"
```

### Notes

- Use `feat`, not `feature`.
- Keep each commit focused on one logical change.
