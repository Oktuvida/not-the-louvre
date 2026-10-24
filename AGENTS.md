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

## Remaster In Progress

All remaster work happens on the long-lived `remaster` branch, which is merged into `main` only when the owner decides it is ready. The plan, the decisions already made and the phase checklist live in [`docs/remaster/README.md`](docs/remaster/README.md); the technical evidence behind them is in `docs/remaster/informe-stack.md`.

Never trigger the deploy workflow manually (`workflow_dispatch`) from `remaster`: that path deploys to production. A draft pull request from `remaster` to `main` runs the quality jobs without deploying.

---

## Development Methodology

### Test-Driven Development (Test-First)

Every behavior change starts with a failing test:

1. **Red** — Model the behavior as a business scenario first, then write the test from that scenario. Run it; it must fail.
2. **Green** — Write the minimum code to make the test pass.
3. **Refactor** — Clean up while keeping the tests green.

Do not skip the red step. A test that has never been seen failing proves nothing.

The red step is the most important phase and must happen before design details or implementation details.
Think in user outcomes, not functions, classes, or endpoints. Start with what the user is trying to achieve and what the system must guarantee.

Business-scenario-first test modeling:

1. Describe the user flow in plain language (example: "A user finishes drawing artwork and clicks save").
2. Define the expected business outcome (example: "The artwork is persisted and can be retrieved in the user's gallery").
3. Encode that outcome as a failing test.
4. Only then write the minimum code needed to satisfy the test.

If code exists before a failing scenario test, the process is out of order.

### Test Strategy

Write each test at the level where the behavior actually lives:

- **SQL** runs against a real Postgres in the contract suites. Never verify SQL with fakes that reimplement it.
- **User journeys** are Playwright e2e tests.
- **Unit tests** cover pure logic only.
- **Component specs** are for interaction-heavy widgets, and query by role and text, not by class names or test ids.
- **No source-text tests.** A test that greps code or CSS, or pins generated SQL as its only guard, passes while the product is broken.

### Automated Quality Gates

All quality checks run as scripts — never rely on manual review alone.

After every change, run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` before considering the work complete.

| Script | What it checks |
| --- | --- |
| `bun run format` | Code formatting (Prettier) |
| `bun run lint` | Lint rules (ESLint + Prettier check) |
| `bun run check` | Type-checking (svelte-check + TypeScript) |
| `bun run test:unit` | Unit & component tests (Vitest) |
| `bun run test:e2e` | End-to-end tests (Playwright) |
| `bun run test` | Unit + e2e combined |
| `bun run --filter @not-the-louvre/web test:integration` | Integration suites against a real Postgres and wrangler's local R2 (runs in CI, see below) |

Before pushing code, all of the above must pass. Prefer running them in order: format → lint → check → test.

The integration suites (`*.integration.test.ts`) are gated on `RUN_INTEGRATION=1` and skip
everywhere else. The SQL contract suite (`db.contract.integration.test.ts`) is where the raw
SQL this app ships — fork lineage, keyset paging, the rate-limit upsert — is actually
executed; the media and avatar suites publish and read images through the app's R2 bucket (`BUCKET`),
which each suite emulates with wrangler's `getPlatformProxy`. They need only Postgres and
run in CI's `database` job. To run them locally against any plain Postgres, set
`DATABASE_URL` and run `db:platform-objects` (plain Postgres only, never Supabase),
`db:migrate` and `test:integration` with `bun run --filter @not-the-louvre/web`.
The e2e suite builds the Worker and serves it on workerd with `wrangler dev`, using the same
`DATABASE_URL` through Wrangler's local Hyperdrive emulation and a local R2 bucket, so it
exercises the production runtime rather than Node.

### Reproducibility (Everything-as-Code)

Local development must be reproducible from a clean clone:

- **Infrastructure**: `compose.yaml` defines all services. `bun run db:start` brings up only the ones the app talks to (`db`, `kong`, `rest`, `storage`, `imgproxy`, `realtime`). Supabase Studio, GoTrue, postgres-meta, logflare and the edge runtime sit behind the `tools` profile: `docker compose --env-file .env.supabase --profile tools up -d`.
- **Live updates**: votes and comments reach open artworks through the realtime Worker in `apps/realtime` (one Durable Object per artwork). The e2e suite starts both Workers in one `wrangler dev`, which is the tested path. `bun run dev` serves the app without it and live updates stay off; running `bun run --filter @not-the-louvre/realtime dev` alongside should connect them through wrangler's dev registry, but that path is untested.
- **Commit hooks**: run `bun run hooks:install` once per clone to enable the commit-message hook (`git config core.hooksPath .githooks`).
- **Dependencies**: `bun install` from root. Lockfile is committed.
- **Environment**: `.env.example` documents every required variable.
- **Schema**: Drizzle migrations define the database state (see below).
- **CI**: Same scripts locally and in CI — no hidden steps. `.github/workflows/deploy.yml` runs `lint`, `check`, `test:unit:server` and `test:unit:client` on every pull request and before every deploy, plus, in its `database` job, the integration suites and the e2e suite (except the `@realtime` demo) against a Postgres service container.

---

## Database Conventions

This project follows a **code-first** approach with Drizzle ORM.

### Schema Changes (Always Migrated)

All structural changes to the database go through migrations:

1. Edit the schema in `apps/web/src/lib/server/db/schema.ts`.
2. Generate a migration: `bun run db:generate`.
3. Apply it: `bun run db:migrate`.

Never modify the database schema by hand. The migration history is the source of truth.

### Custom Migrations

Custom Drizzle migrations are for database changes that Drizzle cannot express or generate natively from the TypeScript schema.

Use them for SQL-first capabilities such as RLS policies, realtime configuration, triggers, functions, grants, or other Postgres features that live outside Drizzle's normal schema generation flow.

Do not use a custom migration for schema changes that Drizzle can represent directly in `schema.ts`.

Custom Drizzle migrations are created from `apps/web`.

1. Always run `bun run db:generate` first.
2. Change into `apps/web`.
3. Generate the custom migration with `bunx drizzle-kit generate --custom`.

Do not skip the standard generation step before creating a custom migration.

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

## Skills Index

Skills live in `.agents/skills/` and provide domain-specific knowledge to AI agents working on this codebase.

| Skill | When to use |
| --- | --- |
| `brainstorming` | Before any creative work — creating features, building components, adding functionality, or modifying behavior. Explores intent and design before implementation. |
| `drizzle-orm` | When working with Drizzle ORM — schema definitions, queries, migrations, or related TypeScript database code. |
| `frontend-design` | When building web components, pages, dashboards, or styling/beautifying any web UI. Produces distinctive, production-grade interfaces. |
| `rest-api-design` | When creating new APIs, designing endpoints, or improving existing API architecture. Covers resource modeling, HTTP methods, status codes, and versioning. |
| `supabase-postgres-best-practices` | When writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations. |
| `svelte-code-writer` | When creating, editing, or analyzing any Svelte component (`.svelte`) or Svelte module (`.svelte.ts` / `.svelte.js`). |
| `threlte-official-docs` | When answering Threlte-specific questions or locating Threlte APIs, guides, or package docs. Restricts evidence to official Threlte docs and the official `threlte/threlte` repo. |

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
