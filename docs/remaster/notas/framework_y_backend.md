# Framework and backend stack on Cloudflare Workers: currency and fitness check (as of 2026-10-23)

Scope: each layer of the current stack (framework, 3D, data layer, Postgres host, ORM/driver, auth, testing), checked for current version, maintenance health, known problems on Workers, better alternatives, and a recommended choice for the remaster. Version numbers come from the npm registry, queried on 2026-10-23 with `npm view <pkg> version dist-tags time`. Where a claim depends on reading the repo, the file is named.

What the repo pins today (from `apps/web/package.json` and `apps/web/wrangler.jsonc`):
- **Framework:** `@sveltejs/kit ^2.50.2`, `svelte ^5.54.0`, `@sveltejs/adapter-cloudflare ^7.2.8`, `vite ^7.3.1`
- **3D:** `@threlte/core ^8.5.2`, `@threlte/extras ^9.13.0`, `three ^0.183.2`
- **Data and auth:** `drizzle-orm ^0.45.1`, `postgres ^3.4.8`, `better-auth ~1.4.21` (installed: 1.4.21/1.4.22)
- **Testing and tooling:** `vitest ^4.1.0`, `wrangler ^4.100.0`, `compatibility_date 2026-06-01`, `nodejs_compat`
- **Connection setup** (`apps/web/src/lib/server/db/index.ts`):
  - postgres.js runs with `{ connect_timeout: 10, prepare: false }`, through Drizzle `drizzle-orm/postgres-js`.
  - Each request gets its own connection through AsyncLocalStorage, and `client.end({ timeout: 5 })` is registered with `waitUntil`.
  - Hyperdrive points at Supabase's Supavisor pooler in session mode (:5432).
- **Request hook** (`apps/web/src/hooks.server.ts`): reads `event.platform.env.HYPERDRIVE.connectionString` and `event.platform.context`.

---

## Q1. SvelteKit / Svelte 5 (and Threlte) in October 2026: versions, remote functions, async Svelte, adapter-cloudflare, Workers pitfalls

### Takeaway
SvelteKit is healthy and current. Version 3.0.0 shipped on 2026-10-01 and 3.1.0 is the latest. Svelte is at 5.57.2. Cloudflare still documents SvelteKit as a first-class Workers framework. The two features the remaster would want most are still experimental: remote functions (`query`/`command`/`form`/`prerender`) and async Svelte (`await` in components). adapter-cloudflare 8 also has real gaps that are still open:
- It can't export Durable Object classes from the app Worker.
- Vite 8 / Rolldown produces some build/runtime bugs.
- Dev mode emulates bindings from Node instead of running in workerd.

The prior "keep SvelteKit" conclusion holds. Plan to adopt Kit 3 and treat remote functions and async as opt-in experimental features, not as the foundation.

### Cited Findings
**Versions and release dates**
- npm latest as of 2026-10-23: `@sveltejs/kit` 3.1.0 (3.0.0 published 2026-10-01T17:22Z, 3.0.1 on 2026-10-06, 3.1.0 on 2026-10-14), `svelte` 5.57.2 (5.57.0 on 2026-08-28), `@sveltejs/adapter-cloudflare` 8.0.1, `@sveltejs/vite-plugin-svelte` 7.3.1, `vite` 8.3.5. — [npm @sveltejs/kit](https://www.npmjs.com/package/@sveltejs/kit); [npm svelte](https://www.npmjs.com/package/svelte); [npm adapter-cloudflare](https://www.npmjs.com/package/@sveltejs/adapter-cloudflare)
- The SvelteKit 3 release candidate was announced on 2026-08-13. Its main changes:
  - Config moves from `svelte.config.js` into `vite.config.ts`.
  - `$lib` becomes `#lib` subpath imports, which need explicit file extensions.
  - `tsconfig.json` extends `$app/tsconfig`.
  - Env vars are declared in `src/env.ts` and are no longer experimental.
  - Error handling is built on Svelte 5 error boundaries.
  - Vite 8 (Rolldown) and the Vite Environment API are required.
  - Migration tool: `npx sv migrate sveltekit-3`. — [Svelte blog: SvelteKit 3 RC](https://svelte.dev/blog/sveltekit-3-release-candidate)
- The RC post says remote functions "remain behind an `experimental` flag as we iron out the last few kinks." It also says dropping `FetchableDevEnvironment` means local dev access to "Cloudflare Workers bindings" needs other solutions, which the team was "still exploring." — [Svelte blog: SvelteKit 3 RC](https://svelte.dev/blog/sveltekit-3-release-candidate)
- A third-party changelog confirms the stable 3.0 release day (Netlify: "SvelteKit 3 just works on Netlify", 2026-10-01). — [Netlify changelog](https://www.netlify.com/changelog/2026-10-01-sveltekit-3/)

**Kit 3.0.0 changelog: breaking changes that touch this repo**
- Platform requirements: Node 22.17, TypeScript 6, `vite@^8.0.12`, `@sveltejs/vite-plugin-svelte` v7, Svelte 5.56.4 or newer.
- `$app/stores` is removed. `$app/state` is the replacement, and the `Page` types move to `$app/state`.
- `$lib` is replaced by `#lib`.
- `invalidateAll` is deprecated in favour of `refreshAll`.
- "disallow `*.remote.ts/js` files unless `experimental.remoteFunctions` is enabled" — so remote functions are still experimental in 3.0.
- Tracing moves out of the experimental namespace.
- Source: [SvelteKit CHANGELOG (raw)](https://raw.githubusercontent.com/sveltejs/kit/main/packages/kit/CHANGELOG.md)
- 3.1.0 adds CSP hash-reporting keywords and a `sveltekit.endpoint` tracing span. — [SvelteKit CHANGELOG](https://raw.githubusercontent.com/sveltejs/kit/main/packages/kit/CHANGELOG.md)

**Remote functions and async Svelte**
- The remote functions docs say: "This feature is currently experimental, meaning it is likely to contain bugs and is subject to change without notice" (added in 2.27).
  - Enabling them takes `experimental.remoteFunctions: true` plus `compilerOptions.experimental.async: true`.
  - Available types: `query`, `query.batch` (since 2.35), `query.live` (streams through an async generator), `form`, `command`, `prerender`.
  - Single-flight mutations are supported.
  - Source: [SvelteKit docs: Remote functions](https://svelte.dev/docs/kit/remote-functions)
- Async Svelte (`await` in components): "This feature is currently experimental, and you must opt in by adding the `experimental.async` option."
  - "The experimental flag will be removed in Svelte 6."
  - Details may change in breaking ways outside a semver major release.
  - Streaming SSR for `await` is "planned but not implemented yet."
  - Source: [Svelte docs: await expressions](https://svelte.dev/docs/svelte/await-expressions)
- Svelte 5.55–5.57 changelogs are dominated by async and hydration fixes, which shows the feature is still settling in late 2026. Examples:
  - "don't create async deriveds for a component destroyed while waiting for its top-level `await`" (5.57.2)
  - "replacing async 'blocking' strategy with 'merging'" (5.55.6)
  - Source: [Svelte CHANGELOG (raw)](https://raw.githubusercontent.com/sveltejs/svelte/main/packages/svelte/CHANGELOG.md)

**adapter-cloudflare 8**
- 8.0.0 changelog, verbatim:
  - "remove cloudflare `platform`, emulate the `cloudflare:workers` module instead"
  - "remove `platform.context` in favour of `platform.ctx`"
  - "minimum Wrangler version required is `4.118.0`"
  - "require SvelteKit 3"
  - "remove use of the Cloudflare Workers Cache API in favour of Workers Caching"
  - Source: [adapter-cloudflare CHANGELOG (raw)](https://raw.githubusercontent.com/sveltejs/kit/main/packages/adapter-cloudflare/CHANGELOG.md)
- The adapter docs say it targets Workers Static Assets: `main: .svelte-kit/cloudflare/_worker.js`, `assets.binding: ASSETS`.
  - Bindings come from `import { env } from 'cloudflare:workers'`.
  - Dev and preview get bindings through `platformProxy` (Wrangler's `getPlatformProxy`).
  - Stated limitation: "Durable Objects and Workflows, which require custom classes to be exported from your worker, are not currently supported."
  - "You can't use `fs` in Cloudflare Workers."
  - Source: [SvelteKit docs: adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare)
- Cloudflare's own SvelteKit guide (dateModified 2026-10-10) still documents SvelteKit on Workers with Workers Assets through `@sveltejs/adapter-cloudflare`. — [Cloudflare docs: SvelteKit guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)

**Open adapter-cloudflare issues (state checked with `gh issue view` on 2026-10-23)**
- [#13692](https://github.com/sveltejs/kit/issues/13692) "Allow custom worker script when deploying to Cloudflare": open since 2025-04-08, milestone "3.x". This is the issue that blocks exporting a DO class from the app Worker.
- [#15960](https://github.com/sveltejs/kit/issues/15960) "adapter-cloudflare on Vite 8 (Rolldown): worker fails to start with createRequire(import.meta.url) when a CJS dep uses a Node builtin": open since 2026-06-05.
- [#17271](https://github.com/sveltejs/kit/issues/17271) "adapter-cloudflare + Vite 8/Rolldown: `cloudflare:workers` left as protocol import in SSR output (`vite preview` fail)": open since 2026-09-30.
- [#15035](https://github.com/sveltejs/kit/issues/15035) "Prerendered Remote Function fails in production" (Cloudflare and Node): open since 2025-12-06.

**Threlte (3D)**
- `@threlte/core` 8.6.1 was published 2026-09-24 (8.6.0 on 2026-08-26, and many 8.5.x patches March–May 2026). `@threlte/extras` 9.22.3 was published 2026-10-21.
- Peer dependencies are `svelte >=5` and `three >=0.172`. `three` latest is 0.186.1.
- Source: [npm @threlte/core](https://www.npmjs.com/package/@threlte/core); [npm @threlte/extras](https://www.npmjs.com/package/@threlte/extras)

### Inferences
**Concrete migration impact for this repo** (from the changelogs above plus `hooks.server.ts` and `db/index.ts`):
- `event.platform.env.HYPERDRIVE` and `event.platform.context` stop existing under adapter 8. They need to become `import { env } from 'cloudflare:workers'` and `platform.ctx` (or the `cloudflare:workers` equivalent).
- Every `$lib/...` import becomes `#lib/....ts`.
- The `svelte.config.js` content (the runes option) moves into `vite.config.ts`.
- Wrangler must be at least 4.118, up from 4.100.
- Vite 7 → 8 and TypeScript 5.9 → 6.
- The adapter now uses Workers Caching instead of the Cache API. That matters because the app edge-caches media/avatar responses, and `db/index.ts` detects Workers through `caches.default`.

**Durable Objects:** adapter 8 can't export DO classes (#13692). The multiplayer game-room Durable Objects should live in a separate Worker, which the SvelteKit Worker binds to with `script_name` (see Q2/Q7). That is a sensible split for this product anyway: game-room lifecycle and deploys stay separate from SSR.

**Remote functions:** they are attractive for a "very clean backend":
- typed RPC
- `query.batch` against the n+1 problem
- single-flight mutations

But they are still experimental in Kit 3, need experimental async Svelte, and have an open production bug with prerendered remote functions on Cloudflare (#15035). Reasonable options:
- adopt them for new non-critical reads and writes, with a thin service layer underneath so a breaking change is contained, or
- keep `+page.server.ts` load functions plus `+server.ts` JSON endpoints as the baseline.

**Async Svelte:** async SSR has no streaming yet, so a Pinterest-style gallery should not rely on component-level `await` for first paint. Use load functions or streamed promises from `load`, and progressive client fetching.

**Threlte:** actively maintained and compatible with Svelte 5. For a single landing scene it remains a fine choice. The main cost is bundle weight (three.js), so lazy-load the scene route/component. Nothing suggests Threlte needs replacing.

**Verdict on the prior review:** "keep SvelteKit" is confirmed by current evidence. SvelteKit 3 is freshly released and maintained, Cloudflare documents it, and none of the gaps found is a blocker with a workaround missing.

### Gaps
- I found no official svelte.dev stable-release post for SvelteKit 3.0. The stable date comes from npm publish times and the Netlify changelog.
- I found no announced date for removing the remote functions experimental flag, or for Svelte 6.
- I found no data on whether SvelteKit 2.x keeps getting security backports after 3.0.
- I didn't verify whether Kit 3 dev mode on Cloudflare runs code in workerd or in Node with emulated bindings, beyond the RC post saying it is "still exploring" and the adapter docs describing `platformProxy`. It matters for parity with Hyperdrive, DOs and R2 in dev.

---

## Q2. Data layer on Workers: Hyperdrive, Postgres driver and connection reuse, placement, D1 and Durable Object SQLite

### Takeaway
Cloudflare's current docs say node-postgres (`pg`) is the recommended driver for Hyperdrive. They also state, verbatim: "Pairing Drizzle ORM with the Postgres.js driver over Hyperdrive is not currently supported." They warn against `prepare: false`, which the repo uses, and say you do not need to call `client.end()`. The repo's driver setup therefore goes against current guidance on three counts. The remaster should use `drizzle-orm/node-postgres` with a new `pg.Client` per request.

Hyperdrive query caching is on by default (`max_age` 60 s, `stale_while_revalidate` 15 s), and writes never invalidate the cache. Plan two Hyperdrive configs, cached and uncached.

Cloudflare recommends a direct database connection over the provider's pooler. Supabase's direct host is IPv6-only unless you buy the $4/month IPv4 add-on, and Hyperdrive's IPv6 support is undocumented.

On the alternatives: D1 is not the right home for the existing Postgres data. DO SQLite is the right tool for live game-room state.

### Cited Findings
**Driver and connection guidance**
- On the recommended driver, Cloudflare says: "Node-postgres (`pg`) is the recommended driver for connecting to your Postgres database from JavaScript or TypeScript Workers. It has the best compatibility with Hyperdrive's caching... Postgres.js is also supported."
  - Minimum versions: `pg@8.16.3` and `postgres@3.4.5`.
  - Source: [Cloudflare docs: Connect to PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/) (verified in the raw `index.md`)
- Cloudflare's warning, verbatim: "Do not use `prepare: false` with Postgres.js ... Postgres.js then sends additional protocol messages to discover parameter types before each query. Hyperdrive's transaction pooling mode does not reliably support this behavior. This can cause queries to hang or fail intermittently." The Postgres.js example uses `max: 5` and `fetch_types: false`. — [Cloudflare docs: Connect to PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)
- Cloudflare's Drizzle guide says: "Pairing Drizzle ORM with the Postgres.js driver over Hyperdrive is not currently supported. Switch your driver to node-postgres (`pg`), the recommended driver for Drizzle ORM with Hyperdrive." Its example: `new Client({ connectionString: env.HYPERDRIVE.connectionString })`, then `await client.connect()`, then `drizzle(client)` from `drizzle-orm/node-postgres`. — [Cloudflare docs: Drizzle ORM with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)
- Drizzle issue #6096 (open, 2026-08-04) explains why prepare is off even when you ask for it: "When the Postgres.js client is configured with `{ prepare: true }`, ordinary Drizzle queries still run without prepared statements ... Drizzle executes ordinary queries through `client.unsafe(query, params)` ... Postgres.js treats an `unsafe()` call without query options as `prepare: false`."
  - The report environment is "postgres@3.4.9, Cloudflare Workers with Hyperdrive."
  - A 2026-10-06 comment says the attempted fix on `1.0.0-rc.5` "throws inside every transaction."
  - Source: [drizzle-orm #6096](https://github.com/drizzle-team/drizzle-orm/issues/6096)
- On closing connections, Cloudflare says: "You do **not** need to call `client.end()`, `sql.end()` ... Workers-to-Hyperdrive connections are automatically cleaned up when the request or invocation ends." It also says to always create clients inside handlers and never use a global `new Pool()`. — [Cloudflare docs: Connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/)
- Open postgres.js issues on workerd (from `gh search`, 2026-10-23):
  - #1202 "Cloudflare/workerd: every sql.end() leaves an unhandled rejection (Stream was cancelled)" (2026-08-28)
  - #1196 "Cloudflare polyfill: unhandled rejection when a connection closes" (2026-08-20)
  - #1213 "a failed TLS handshake (untrusted CA, e.g. Supabase) surfaces as CONNECT_TIMEOUT" (2026-09-05)
  - #1225 "Unprepared queries with parameters take two round trips" (2026-09-24)
  - #960 "[Cloudflare Hyperdrive] prepared statement ... already exists" (2024, still open)
  - Source: [porsager/postgres issues](https://github.com/porsager/postgres/issues)
- Release cadence: `postgres` (postgres.js) latest is 3.4.9 (2026-04-05; 3.4.8 on 2026-01-06). `pg` latest is 8.23.1 (2026-09-30). — [npm postgres](https://www.npmjs.com/package/postgres); [npm pg](https://www.npmjs.com/package/pg)
- Compatibility date: "For compatibility dates of `2026-08-04` or later, Workers and Pages projects enable both `nodejs_compat` and `nodejs_compat_v2` by default." — [Cloudflare docs: Connect to PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)

**Hyperdrive query caching, pricing and limits**
- Caching is "enabled by default": "`max_age` = 60 seconds" and "`stale_while_revalidate` = 15 seconds" (maximum 1 hour).
  - Queries that use STABLE/VOLATILE functions (`NOW()`, `RANDOM()`, ...) are not cached.
  - "Hyperdrive does not purge or invalidate cached read query results when your application writes to your database."
  - Recommended pattern: a second config created with `--caching-disabled`, bound as e.g. `HYPERDRIVE_CACHE_DISABLED`, "for auth, permissions, billing, and reads right after writes."
  - Source: [Cloudflare docs: Query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- The troubleshooting docs say driver settings such as "Postgres.js with `prepare: false`" can make queries uncacheable. They also advise "not wrapping queries in transactions to allow the connections to be shared more aggressively." — [Cloudflare docs: Hyperdrive troubleshooting](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/)
- Pricing: "Hyperdrive is included in both the Free and Paid Workers plans." Free allows 100,000 queries/day, Paid is unlimited, and pooling and caching are "included in Workers Paid plan." Hyperdrive can also bill PlanetScale databases through the Cloudflare invoice. — [Cloudflare docs: Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
- Limits: about 20 origin connections per config on Free and about 100 on Paid; 60 s maximum query duration; 50 MB maximum cached response; 10 minute idle timeout; 25 configs per account on Paid. — [Cloudflare docs: Hyperdrive limits](https://developers.cloudflare.com/hyperdrive/platform/limits/)
- Release notes:
  - 2025-03-07: "Connection pools are placed as close to your database as possible, reducing latency for uncached queries and new connections by up to 90%."
  - 2025-05-05: prepared statements cached closer to Workers, "up to 5x faster cache hits."
  - 2025-07-03: configurable connection count, minimum 5.
  - 2025-12-04: remote DB in `wrangler dev`.
  - No 2026 entries are listed.
  - Source: [Hyperdrive release notes](https://developers.cloudflare.com/hyperdrive/platform/release-notes/)

**Supabase connection and IPv6**
- Cloudflare's Supabase guide says: "you should use the **Direct connection** connection string rather than the pooled connection strings" because "Hyperdrive will perform pooling of connections." The example uses `pg`. — [Cloudflare docs: Hyperdrive + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)
- Supabase: the direct connection is "IPv6 unless IPv4 Add-On is enabled." The Supavisor pooler on ports 6543/5432 "Always uses an IPv4 address." The add-on is for Pro plans and above. — [Supabase docs: Dedicated IPv4](https://supabase.com/docs/guides/platform/ipv4-address)
- The IPv4 add-on costs "$0.0055 per hour ($4 per month)." — [Supabase docs: Manage IPv4 usage](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4)
- Hyperdrive and IPv6:
  - The Hyperdrive docs only say "Hyperdrive can only connect to public IP addresses" (error 2009). They make no IPv6 statement. — [Cloudflare docs: Hyperdrive troubleshooting](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/)
  - A Cloudflare Community thread from about October 2026 reports Hyperdrive error 2015 for an IPv6-only Supabase host with verify-full, with no visible resolution. I saw it only as a search snippet; fetching the page returned 403. — [Cloudflare Community thread](https://community.cloudflare.com/t/hyperdrive-error-2015-connecting-to-ipv6-only-supabase-postgresql-with-verify-full/967698)

**Placement**
- Smart Placement: `"mode": "smart"`, "available on all Workers plans."
- Explicit hints:
  - `region = "aws:us-east-1"` (AWS/GCP/Azure)
  - `host = "db.example.com:5432"` (TCP probe, experimental)
  - `hostname = "..."` (HTTP probe)
- Limitations:
  - Placement affects only `fetch` handlers, not RPC/named entrypoints.
  - "Static assets are served from the location nearest the request."
  - Source: [Cloudflare docs: Workers placement](https://developers.cloudflare.com/workers/configuration/placement/)

**D1**
- Limits on the paid plan: 10 GB per database (500 MB on free); 1,000 queries per invocation; 30 s maximum query duration; 2 MB maximum row/BLOB; 100 KB maximum statement; 100 maximum bound parameters; 30-day Time Travel. — [Cloudflare docs: D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- Read replication entered "public beta" on 2025-04-10. The Sessions API is Worker-binding-only. I found no GA announcement. — [Cloudflare changelog: D1 read replication beta](https://developers.cloudflare.com/changelog/post/2025-04-10-d1-read-replication-beta/); [D1 read replication docs](https://developers.cloudflare.com/d1/best-practices/read-replication/)

**Durable Objects (SQLite-backed)**
- 10 GB per object; unlimited per account on Paid; 30 s CPU per request by default, configurable to 5 min; soft limit of 1,000 requests per second per object; 32 MiB maximum WebSocket message; available on Workers Free. — [Cloudflare docs: Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- On DOs holding database connections, Cloudflare advises: "Be careful when maintaining persistent database connections in Durable Objects... Close connections when not actively in use... limit the number of Durable Objects that maintain database connections." — [Cloudflare docs: Connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/)
- Binding to a DO class in another Worker uses `script_name` in the `durable_objects.bindings` entry. — [Wrangler configuration docs](https://developers.cloudflare.com/workers/wrangler/configuration/)

### Inferences
**Current repo against current guidance** (`apps/web/src/lib/server/db/index.ts`):
1. It uses Drizzle + postgres.js over Hyperdrive, which Cloudflare says is "not currently supported."
2. It sets `prepare: false`, which Cloudflare says "can cause queries to hang or fail intermittently" under Hyperdrive. Drizzle forces this setting anyway (#6096).
3. It calls `client.end({ timeout: 5 })` inside `waitUntil`. That is unnecessary per Cloudflare, triggers postgres.js #1202 unhandled rejections on workerd, and is billed wall time.

Moving to `pg` + `drizzle-orm/node-postgres` with one `Client` per request and no `end()` removes all three problems. It also removes the need for the AsyncLocalStorage/Proxy machinery beyond request scoping. This may also explain some of the intermittent connection failures mentioned in the user's memory notes, but that is a hypothesis to test, not a proven cause.

**Caching:** today's `prepare: false` probably makes most queries uncacheable, so the app likely sees almost no Hyperdrive caching. After switching to `pg`, default caching (60 s, no invalidation on write) will start applying. Two consequences:
- A user who just voted or published may read stale data.
- The fix is to create a second, cache-disabled Hyperdrive config for session/auth, user-specific reads and read-after-write paths. Leave caching on only for public gallery and feed queries, where 60 s staleness is acceptable or even desirable.

**Supabase connection string, two options:**
- (a) Keep Hyperdrive pointed at Supavisor session mode (:5432, IPv4). This works today but double-pools, which is against Cloudflare's guidance.
- (b) Buy the $4/month IPv4 add-on and point Hyperdrive at the direct connection, as Cloudflare recommends.

Pointing Hyperdrive at the IPv6-only direct host is risky until Cloudflare documents IPv6 origins. Never use Supavisor transaction mode (:6543) behind Hyperdrive.

**Placement:** Hyperdrive already puts its pools near the database, but every uncached query still makes a round trip from the Worker's colo to that pool. An SSR page that runs several sequential queries (session check, profile, gallery page, counts) pays that round trip each time when the user is far from us-east-1.
- Setting `placement.region = "aws:us-east-1"` on the SvelteKit Worker trades one user→Worker round trip for N short Worker→pool round trips. That is usually a win for DB-heavy SSR.
- Static assets still come from the nearest location.
- Keep the gallery's cacheable, session-independent routes (media, avatars) fast through edge caching, R2 and custom domains rather than through the placed Worker.

**D1:** not right for the main data. The Postgres data must be kept, and D1 brings a 10 GB per-database ceiling, a 100 bound-parameter limit and replication still in beta. Migrating the relational, fork-lineage and keyset-paging data model off Postgres adds risk for no clear gain.

**Durable Object SQLite:** the right tool for live game rooms. A room owns players, rounds, strokes in flight and timers, broadcast over hibernatable WebSockets, and persists a final snapshot to Postgres (through Hyperdrive, on a short-lived connection) and media to R2 when a round ends. This also replaces Supabase Realtime.

### Gaps
- I found no official Cloudflare statement on Hyperdrive IPv6 origin support (only an unresolved community report).
- I found no measured latency numbers for Hyperdrive with region placement versus without for a us-east-1 origin.
- I didn't verify whether the app's existing Hyperdrive config has caching disabled. That setting lives in the Hyperdrive config, not in `wrangler.jsonc`.

---

## Q3. Postgres host: Supabase vs Neon vs PlanetScale Postgres (and staying on Supabase DB-only)

### Takeaway
All three work with Hyperdrive.
- **PlanetScale Postgres** has the tightest Cloudflare integration (automatic Hyperdrive config, billing through the Cloudflare invoice) and the cheapest always-on entry price: $5 single-node, $15 high availability (HA).
- **Neon** has the best branching and no monthly minimum, but scales to zero (cold starts).
- **Supabase** has no cold starts and is where the data already lives. Used only as a database, though, it means paying $25+/month for a bundle of features the remaster is dropping (Storage, Realtime, Auth).

Staying on Supabase is defensible as the lowest-risk path, as long as it is on Pro (the free tier pauses after a week of inactivity). PlanetScale Postgres is the best fit for a Cloudflare-centric, modest-budget remaster. No source benchmarks the three through Hyperdrive.

### Cited Findings
**Supabase**
- Free: 500 MB database; "paused after 1 week of inactivity"; 2 active projects; no automatic backups.
- Pro: from $25/month, includes $10 compute credits (one Micro, 1 GB RAM); 8 GB disk, then $0.125/GB; daily backups kept 7 days.
- Add-ons: PITR is "$100 per month per 7 days retention"; branching is "$0.01344 per branch, per hour"; Small compute is $15/month.
- Source: [Supabase pricing](https://supabase.com/pricing)
- IPv4 add-on: $4/month, needed for a direct IPv4 connection. — [Supabase docs: Manage IPv4 usage](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4)

**Neon**
- Free: 100 CU-hours per project; 1 GB storage per project (20 GB total); 10 branches; 6-hour history; compute suspends after 5 min and this can't be disabled.
- Launch: "no monthly minimum"; $0.106/CU-hour; $0.35/GB-month storage; 10 branches included, then $1.50/branch-month; up to 7 days restore history; scale-to-zero after 5 min, which can be disabled.
- Scale: $0.222/CU-hour; up to 30 days history; SLA.
- Child branches are copy-on-write and "start at $0."
- Source: [Neon pricing](https://neon.com/pricing)

**PlanetScale Postgres**
- PS-5 (1/16 vCPU, 512 MiB): $5 single node / $15 HA (1 primary + 2 replicas).
- PS-10 (1/8 vCPU, 1 GiB): $10 / $30 (arm64).
- PS-20 (1/4 vCPU, 2 GiB): $17 / $50.
- Metal HA from $50.
- Default region AWS us-east-1.
- Extra storage and backups are billed separately; the page gives no rates.
- Source: [PlanetScale pricing](https://planetscale.com/pricing)
- Cloudflare and PlanetScale partnership (2025-09-25):
  - You link accounts and "a Hyperdrive configuration is then created automatically for each PlanetScale database."
  - Hyperdrive "places its pool of database connections in Cloudflare data centers with the lowest possible latency."
  - Cloudflare positions it for "regional databases for your application's control plane."
  - Source: [Cloudflare blog: PlanetScale Postgres + Workers](https://blog.cloudflare.com/planetscale-postgres-workers/); [Cloudflare docs: PlanetScale with Hyperdrive](https://developers.cloudflare.com/hyperdrive/planetscale/)
- PlanetScale usage can be billed "through your Cloudflare account as a pay-as-you-go customer." — [Cloudflare docs: Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)

**Benchmarks and cold starts**
- I found no head-to-head benchmark of Supabase, Neon and PlanetScale through Hyperdrive.
- PlanetScale publishes a vendor-run benchmark against Neon/Lakebase (no Hyperdrive, no Supabase), so treat it as biased. — [PlanetScale benchmarks vs Neon](https://planetscale.com/benchmarks/neon-lakebase)
- Secondary sources say Neon is the only one of the three that scales to zero by default, with roughly 400–750 ms on the first query after idle. These are not measurements. — [techsy.io comparison](https://techsy.io/no/blogg/neon-vs-planetscale-vs-turso-sammenligning); [Bytebase: Neon vs Supabase](https://bytebase.com/blog/neon-vs-supabase)

### Inferences
**Cost at small scale** (rough, excluding storage and egress):
- Supabase Pro + Micro: about $25/month. Adding the IPv4 add-on for a direct Hyperdrive connection makes it about $29.
- PlanetScale: PS-10 single node about $10/month; PS-10 HA about $30.
- Neon Launch: a few dollars a month with scale-to-zero. Keeping 0.25 CU always on costs about 0.25 × 730 h × $0.106 ≈ $19/month.

**Cold starts:** a party game with bursty, sporadic traffic is exactly where Neon's scale-to-zero cold start (about 0.5 s) hurts the first visitor. Disabling it erases most of the price advantage.

**Backups:**
- Supabase Pro gives daily backups for 7 days, but PITR costs $100/month.
- Neon gives restore history (7 days on Launch) as storage-priced history.
- PlanetScale bills backups separately (rates not on the page).

**Branching for CI and previews:** Neon is clearly best (copy-on-write, $0 to start). That said, CI for this app can just use a plain `postgres` service container (see Q6), because the remaster drops the Supabase-specific services. So branching is a nice-to-have, not a deciding factor.

**Recommendation:**
- Keep Postgres (the data model needs it).
- Default to staying on Supabase (database only) for the remaster, to separate the app rewrite from the database move, provided it is Pro and not the pausing free tier.
- Plan an optional move to PlanetScale Postgres (us-east-1, linked through the Cloudflare integration) once the app no longer uses any Supabase-specific features. A `pg_dump`/`pg_restore` is enough when the database contains only app schemas, the Better Auth tables and no Supabase `storage`/`realtime` dependencies.
- Choose Neon instead only if per-PR database branches become a priority.

### Gaps
- I couldn't find which Supabase tier the project currently uses, or its database size.
- PlanetScale Postgres per-GB storage and backup prices, and whether branching is available for Postgres, are not on the pricing page.
- I found no independent Hyperdrive latency benchmark across providers.
- I didn't verify Neon's current corporate status or roadmap: it was reportedly acquired by Databricks in 2025, which I did not confirm in this session.

---

## Q4. ORM and driver: Drizzle status (v1, RQB v2, migrations) and alternatives (Kysely, Prisma)

### Takeaway
Drizzle is still the right ORM. The stable line is 0.45.4 (`drizzle-kit` 0.31.11). v1 has been in release candidate since 2026-04-30 and reached `1.0.0-rc.5` on 2026-10-21, but is not GA. Relational Queries v2 (`defineRelations`) ships with v1.

For Workers, the important change is the driver: move from `drizzle-orm/postgres-js` to `drizzle-orm/node-postgres` (`pg`), as Cloudflare documents. Kysely and Prisma 7/8 both work on Workers, but neither is materially better here and both mean a rewrite.

### Cited Findings
- npm dist-tags on 2026-10-23: `drizzle-orm` latest 0.45.4, `rc` 1.0.0-rc.5, `beta` 1.0.0-beta.22. Same pattern for `drizzle-kit` (0.31.11 latest, rc 1.0.0-rc.5).
  - Publish times: 1.0.0-beta.1 on 2025-11-03; rc.1 on 2026-04-30; rc.4 on 2026-06-27; rc.5 on 2026-10-21.
  - Source: [npm drizzle-orm](https://www.npmjs.com/package/drizzle-orm)
- Drizzle's upgrade guide describes the v1 RC. Steps include `drizzle-kit up`, and validators (drizzle-zod and similar) move into `drizzle-orm` imports. — [Drizzle docs: Upgrading to v1 RC](https://orm.drizzle.team/docs/upgrade-v1)
- Relational Queries v2 replaces per-table `relations()` with a single `defineRelations` definition, and the v1 RQB API is removed in Drizzle v1. — [Drizzle docs: Migrating to RQB v2](https://orm.drizzle.team/docs/relations-v1-v2); [Drizzle docs: v0 → v1 changes](https://orm.drizzle.team/docs/v0-v1-changes)
- Drizzle + postgres.js always runs queries through `client.unsafe()` and so ignores `prepare: true` (#6096). A comment on rc.5 reports that the attempted fix "throws inside every transaction." — [drizzle-orm #6096](https://github.com/drizzle-team/drizzle-orm/issues/6096)
- Cloudflare's Drizzle and Hyperdrive guide uses `drizzle-orm/node-postgres` and says Drizzle + Postgres.js over Hyperdrive is "not currently supported." — [Cloudflare docs: Drizzle ORM with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)
- Kysely: latest 0.29.7 (2026-10-17). — [npm kysely](https://www.npmjs.com/package/kysely)
- Prisma: latest dist-tag `8.0.0-rc.27`, previous stable `7.10.1` (2026-10-15).
  - Prisma deploys to Workers with driver adapters (`@prisma/adapter-pg` for TCP Postgres, plus `nodejs_compat`).
  - Its docs note a 3 MB Worker size limit on the free plan, and the page doesn't mention Hyperdrive.
  - Source: [npm prisma](https://www.npmjs.com/package/prisma); [Prisma docs: Deploy to Cloudflare](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare)

### Inferences
- **Stay on Drizzle 0.45.x for now and switch the driver to `pg`.** That is a contained change: the schema, migrations and query builder are unchanged. The work is swapping `drizzle-orm/postgres-js` for `drizzle-orm/node-postgres` and creating `Client` per request. Raw SQL written with postgres.js tagged templates (the `dbClient` proxy) must be ported to Drizzle's `sql` template or to `client.query`.
- **Drizzle v1:** it has been in RC for about 6 months and rc.5 still has open driver-level bugs. Don't make the remaster depend on v1 GA. Write new relational queries with the core query builder or RQB v1 so the later RQB v2 move stays small, and upgrade once v1 is stable.
- **drizzle-kit migrations** (generate/migrate plus custom SQL migrations) remain fine. Run them from CI or a developer machine against the direct database URL, never through Hyperdrive.
- **Alternatives:** Kysely is a good, smaller SQL builder and Better Auth's built-in adapter layer is Kysely-based. But it brings no Workers-specific advantage over Drizzle with `pg`, and switching would discard the existing schema-as-code and migration history. Prisma 7/8 now runs on Workers through driver adapters, but it is heavier, its major version is in flux (8.0 RC) and nothing here favors it.

### Gaps
- I found no announced Drizzle v1 GA date.
- I didn't verify whether Drizzle's `node-postgres` driver has open Workers or Hyperdrive issues of its own. A search of the Drizzle repo for "hyperdrive" returned only postgres.js and effect-postgres issues.

---

## Q5. Auth: Better Auth in 2026 (version, health, Workers compatibility, username/anonymous plugins, rate limiting) and alternatives

### Takeaway
Better Auth is at 1.7.12 (1.8 in beta). It is well funded and actively developed:
- Vercel acquired it on 2026-07-07.
- It took over maintenance of Auth.js in September 2025.

It works on Workers. Its default password hash (scrypt, N=16384, r=16, p=1, dkLen=64, stored as `salt:hexkey`) is unchanged between the installed 1.4 and the latest code, so upgrading keeps existing hashes valid. The newer utils package even uses native `node:crypto` scrypt on workerd. The anonymous plugin covers party-game guests, and rate limiting can use database or secondary storage (a KV/DO-backed adapter is custom work).

Keep Better Auth and upgrade 1.4 → 1.7.x. Switching to another library would mean reimplementing scrypt verification to avoid password resets, with no benefit.

### Cited Findings
**Versions, funding and stewardship**
- npm: `better-auth` latest 1.7.12; dist-tags `beta` 1.8.0-beta.2, `release-1.6` 1.6.33, `release-1.4` 1.4.22.
  - 1.5.0 was published 2026-03-01, 1.6.0 on 2026-04-06, 1.7.0 on 2026-08-18.
  - Source: [npm better-auth](https://www.npmjs.com/package/better-auth)
- GitHub releases: v1.7.12 (20 Oct), v1.7.11 (19 Oct: "Database rate-limit and PostgreSQL migration fixes"), v1.7.8 (14 Oct: "fixed sign-ups ... left inconsistent when secondary-storage session operations failed"), v1.7.7 (30 Sep: Magic Link security fix), v1.8.0-beta.0–2 (15–22 Oct, breaking OAuth/device-code changes). — [Better Auth releases](https://github.com/better-auth/better-auth/releases)
- Vercel acquired Better Auth and hired its founder and core team on 2026-07-07. Better Auth says Vercel "shares our commitment to keeping auth open source, framework and platform agnostic." Vercel cites 4.7M+ weekly downloads and 850+ contributors. — [Better Auth blog: joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel); [Vercel blog: acquires Better Auth](https://vercel.com/blog/vercel-acquires-better-auth)
- On 2025-09-22, Auth.js (NextAuth) became part of Better Auth. It still gets security patches, and Better Auth is recommended for new projects. — [Better Auth blog: Auth.js joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth)

**Upgrade path from 1.4**
- 1.5 breaking changes:
  - `/forget-password/email-otp` removed.
  - Deprecated APIs removed.
  - Adapters moved into separate packages.
  - The API-key plugin moved to its own package.
  - "Stricter defaults" for sign-in and password-reset rate limits.
  - Upgrade with `npx auth upgrade`.
  - Source: [Better Auth 1.5 blog](https://better-auth.com/blog/1-5); [Release v1.5.0](https://github.com/better-auth/better-auth/releases/tag/v1.5.0)

**Password hashing**
- The installed 1.4.22 code (`node_modules/.bun/better-auth@1.4.22+.../dist/crypto/password.mjs`) uses `@noble/hashes` scrypt with `N: 16384, r: 16, p: 1, dkLen: 64`, NFKC-normalised passwords and the format `${saltHex}:${keyHex}`. (Local file read, 2026-10-23.)
- On the main branch, `better-auth` delegates hashing to `@better-auth/utils/password`. The source comment says "Node.js / Bun / Deno → `node:crypto scrypt` ... Unsupported runtimes → `@noble/hashes scrypt`." — [better-auth src/crypto/password.ts](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/crypto/password.ts)
- `@better-auth/utils@0.5.0`:
  - Its `package.json` maps the `"workerd"` export condition of `./password` to `dist/password.node.mjs`.
  - That file uses `node:crypto` `scrypt` with the same `N 16384, r 16, p 1, dkLen 64` and the same `salt:hex` format.
  - Inspected from the npm tarball: [npm @better-auth/utils](https://www.npmjs.com/package/@better-auth/utils)
- The docs say "Better Auth uses `scrypt` to hash passwords." Custom `password.hash` and `password.verify` can be supplied (the example uses argon2). The default length range is 8–128. — [Better Auth docs: Email & Password](https://www.better-auth.com/docs/authentication/email-password)

**Plugins and rate limiting**
- Anonymous plugin:
  - `signIn.anonymous()` creates a user with a generated email (default `{id}@anonymous.placeholder.invalid`) and a name (`generateName`).
  - `onLinkAccount({ anonymousUser, newUser })` moves data when the guest signs up; the anonymous user is deleted after linking by default (`disableDeleteAnonymousUser` turns that off).
  - A second anonymous session can't start while one is active.
  - Source: [Better Auth docs: Anonymous plugin](https://www.better-auth.com/docs/plugins/anonymous)
- Rate limiting:
  - Default storage is memory, which "may not be suitable ... particularly in serverless environments."
  - Options: `storage: "database"`, `storage: "secondary-storage"`, or `customStorage.consume`, which must "check and increment in one operation."
  - Production default: 100 requests per 10 s. `auth.api` calls are not rate limited.
  - No Workers/KV/DO-specific guidance.
  - Source: [Better Auth docs: Rate limit](https://www.better-auth.com/docs/concepts/rate-limit)

**Open Workers issues** (from `gh search` on 2026-10-23)
- [#10315](https://github.com/better-auth/better-auth/issues/10315) "Lazily-cached init promises hang forever on Cloudflare Workers when the initializing request is aborted" (open, 2026-07-05)
- [#11651](https://github.com/better-auth/better-auth/issues/11651) "Runtime schema check can hang every auth request in a Cloudflare Workers isolate when the first request is cancelled" (open, 2026-10-08)
- [#11344](https://github.com/better-auth/better-auth/issues/11344) "Two-factor sign-in intermittently fails ... when `secondaryStorage` (KV) is configured" (open)
- [#11744](https://github.com/better-auth/better-auth/issues/11744) a workerd warning in the oauth-provider plugin

### Inferences
**Keep Better Auth, and move from `~1.4.21` to 1.7.x:**
- Password hashes stay valid, because the same scrypt parameters and storage format are used.
- On workerd, 1.7's utils use native `node:crypto` scrypt instead of pure-JS noble. That should cut CPU time per sign-in and sign-up, which matters under Workers CPU limits. This is inferred from the export map, not benchmarked.
- The custom recovery-key flow and the `username` plugin config should carry over, but check the 1.5 "removed deprecated APIs" list and the adapter-package split. In 1.5+, `drizzleAdapter` may come from a separate package (`@better-auth/drizzle-adapter` or a similar path); confirm this when upgrading.

**Guests:** the anonymous plugin fits party-game guests. Guest → registered conversion runs through `onLinkAccount`, which must re-point the guest's artworks and game results to the new user id.

**Rate limiting on Workers:** use `storage: "database"` (Postgres, uncached Hyperdrive binding), which v1.7.7 hardened against concurrent requests. Alternatively, write a `customStorage.consume` backed by a Durable Object, which gives atomic check-and-increment. KV is eventually consistent and can't do atomic increments, so it is a poor fit for counters. The app already has its own Postgres rate-limit upsert (per AGENTS.md).

**The two open "hang" issues (#10315, #11651)** are relevant: a cancelled first request on an isolate can hang auth. Pin to a version that fixes them once fixes land, and keep an e2e test that aborts the first request.

**Alternatives** (Auth.js is now maintained by Better Auth; hosted IdPs such as Clerk or WorkOS). Switching would require either a forced password reset or a custom scrypt verifier that reproduces Better Auth's exact parameters (possible, since the format is simple). The nickname + recovery-key model doesn't fit hosted email-centric IdPs. There is no reason to switch.

### Gaps
- I couldn't confirm the exact 1.5+ import path for the Drizzle adapter, or whether `better-auth/minimal` (used by the repo) still exists in 1.7.
- I have no benchmark of native versus noble scrypt CPU time on workerd.
- I didn't check whether the anonymous plugin works together with the username plugin without conflicts (for example, generated usernames for guests).

---

## Q6. Testing and tooling on Workers: vitest-pool-workers, Vitest browser mode, Playwright, Postgres in GitHub Actions

### Takeaway
Vitest 5 is stable (5.0.5, released around September 2026) and browser mode with the Playwright provider is mature. Cloudflare has replaced `@cloudflare/vitest-pool-workers` (Vitest 4 only) with the new `@cloudflare/vitest-plugin` (supports Vitest 4.1 and 5), which runs tests inside workerd with per-test-file isolated storage. That is the tool for testing the game-room Durable Objects. Playwright is at 1.64.1.

Once Supabase Storage and Realtime are gone, CI only needs a plain Postgres service container. The database-backed integration suites, currently a manual release step, can then run in CI.

### Cited Findings
**Vitest and Cloudflare test tooling**
- npm: `vitest` latest 5.0.5 (`V4` tag 4.1.12, beta 5.1.0-beta.1); `@cloudflare/vitest-pool-workers` 0.23.0 with peer `vitest ^4.1.0`; `@cloudflare/vitest-plugin` 1.4.7 (first published 2026-08-20) with peer `vitest ^4.1.0 || ^5.0.0`; `@cloudflare/vite-plugin` 1.65.0. — [npm vitest](https://www.npmjs.com/package/vitest); [npm @cloudflare/vitest-plugin](https://www.npmjs.com/package/@cloudflare/vitest-plugin); [npm @cloudflare/vitest-pool-workers](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers)
- The Cloudflare Vitest integration page names `@cloudflare/vitest-plugin`, which "runs your Vitest tests inside the Workers runtime," with "isolated per-test-file storage." Pool-workers users are pointed to a migration guide. — [Cloudflare docs: Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- "Vitest 5.0 is out!":
  - New browser-mode Trace View.
  - ARIA snapshots on locator failures.
  - Prebundled browser runtime.
  - Requires Vite >= 6.4.0 and Node >= 22.12.0.
  - The WebdriverIO provider lagged behind; the Playwright provider was stable.
  - Source: [Vitest 5 blog](https://vitest.dev/blog/vitest-5.html); [Vitest migration guide](https://vitest.dev/guide/migration/); [remotion #11067](https://github.com/remotion-dev/remotion/issues/11067)
- SvelteKit 3.0 includes "fix: ignore Vitest browser loader HTML transforms." — [SvelteKit CHANGELOG](https://raw.githubusercontent.com/sveltejs/kit/main/packages/kit/CHANGELOG.md)

**Playwright and CI database**
- npm: `@playwright/test` 1.64.1 (2026-10-23). — [npm @playwright/test](https://www.npmjs.com/package/@playwright/test)
- GitHub documents PostgreSQL service containers for workflow jobs using the Docker Hub `postgres` image. — [GitHub Docs: PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)

### Inferences
- **Vitest:** upgrade 4.1 → 5 together with the Kit 3 / Vite 8 move (Vitest 5 needs Node ≥ 22.12, and Kit 3 needs Node 22.17 anyway). Keep the `server` and `client` projects, with browser mode using the Playwright provider.
- **Workers runtime tests:** add a third project using `@cloudflare/vitest-plugin` for the DO game-room Worker and any Worker-only code (R2 handlers, DO alarms, WebSocket hibernation). Don't adopt `vitest-pool-workers`: it is pinned to Vitest 4 and superseded.
- **CI database:** AGENTS.md says the integration suites are skipped in CI because they need the local Supabase stack. After the remaster the app only needs Postgres (media in R2, realtime in DOs). A `services: postgres:17` container plus `drizzle-kit migrate` lets the raw-SQL contract suites (fork lineage, keyset paging, rate-limit upsert) run on every pull request, closing the biggest testing gap.
- **Hyperdrive in tests:** run tests against direct Postgres, since Hyperdrive caching is not active in local `wrangler dev` per the 2025-12-04 release note. Add one deployed smoke test that goes through the real Hyperdrive binding (cached and uncached) to catch caching and read-after-write regressions.

### Gaps
- I didn't read the `@cloudflare/vitest-plugin` migration guide in detail (config API, Hyperdrive binding support in tests).
- I didn't verify the stability record of Vitest 5 browser mode beyond the release blog. No major regressions turned up in the searches.

---

## Q7. Would an alternative full stack (React Router v8, TanStack Start, Next.js/OpenNext, SolidStart, Hono + Vite SPA) be materially better for this product on Workers?

### Takeaway
No. React Router v8 and TanStack Start have one concrete Workers advantage: they run on the Cloudflare Vite plugin, so dev runs in workerd and you control the Worker entry file. That lets you export Durable Objects and Workflows from the same Worker, which SvelteKit's adapter can't (#13692). That advantage is fully neutralised by putting the game-room DOs in their own Worker. A framework switch would mean rewriting every Svelte component, including the drawing canvas, gallery and studio, for no measurable gain in performance or platform fit. SvelteKit stays.

### Cited Findings
- **Versions (npm, 2026-10-23):** `react-router` 8.5.0 (`version-7` tag 7.18.4); `@tanstack/react-start` 1.169.4; `next` 16.4.3; `@opennextjs/cloudflare` 1.20.13; `@solidjs/start` 2.1.0; `hono` 4.13.13. — [npm react-router](https://www.npmjs.com/package/react-router); [npm @opennextjs/cloudflare](https://www.npmjs.com/package/@opennextjs/cloudflare); [npm @solidjs/start](https://www.npmjs.com/package/@solidjs/start)
- **Cloudflare's framework list:** React + Vite, Astro, React Router, Next.js / OpenNext, Vue, RedwoodSDK, TanStack Start, SvelteKit, Vike and others. — [Cloudflare docs: Web app framework guides](https://developers.cloudflare.com/workers/framework-guides/web-apps/)
- **React Router v8 on Cloudflare:**
  - It "combines with the Cloudflare Vite plugin to provide a first-class experience."
  - `main` points to `./workers/app.ts`, and "you can also add additional exports such as Durable Objects and Workflows."
  - "SPA mode and prerendering are not currently supported when using the Cloudflare Vite plugin."
  - Source: [Cloudflare docs: React Router guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- **React Router v8 changes:** it removes the old Cloudflare dev proxy in favour of `@cloudflare/vite-plugin` and raises the Node floor to 22.22. A secondary source dates v8.0.0 to 2026-06-17. — [React Router v8 changelog](https://reactrouter.com/8.0.0/changelog); [Remix blog: React Router v8](https://remix.run/blog/react-router-v8)
- **TanStack Start on Cloudflare:** a custom server entrypoint is "where you can add additional exports such as Durable Objects and Workflows." — [Cloudflare docs: TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- **TanStack Start 1.0:** reportedly reached 1.0 on 2026-10-13. Secondary source; I didn't find the TanStack post itself. — [tech-insider.org](https://tech-insider.org/tanstack-start-1-0-stable-release-2026/)
- **TanStack and Cloudflare partnership** (September 2025). — [TanStack blog: Cloudflare partnership](https://tanstack.com/blog/cloudflare-partnership)
- **SvelteKit's limitation:** adapter-cloudflare can't export DO or Workflow classes (#13692, open, milestone 3.x). DOs can be bound from another Worker with `script_name`. — [SvelteKit docs: adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare); [kit #13692](https://github.com/sveltejs/kit/issues/13692); [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)

### Inferences
- **React Router v8 / TanStack Start:** the advantages are workerd-faithful dev and single-Worker DO exports. The costs are a full rewrite into React and a larger client runtime than Svelte for an interaction-heavy canvas and gallery. React's ecosystem has more canvas and gesture libraries, but the app already owns its stroke runtime (`@not-the-louvre/stroke-json-runtime`). Not materially better.
- **Next.js 16 via OpenNext:** the heaviest option on Workers; it is an adapter layer over a Vercel-first framework. Given the user's cost and cleanliness goals and the Cloudflare-only constraint, it is the worst fit. That is inferred from the architecture; I did not collect specific OpenNext issue evidence in this session.
- **SolidStart 2:** fine-grained reactivity similar to Svelte 5 runes, but a smaller ecosystem and a rewrite. No gain.
- **Hono + Vite SPA:** the cleanest API layer, but it gives up SSR for the public gallery and artwork pages (LCP, sharing previews, SEO for shared artworks). A hybrid is reasonable: SvelteKit for pages and SSR, with Hono (or plain Workers) in the separate realtime/DO Worker.
- **Committed answer:** keep SvelteKit 3 + Svelte 5 on adapter-cloudflare. Split multiplayer into a second Worker (Durable Objects + WebSockets; Hono optional for its routes) bound to the app Worker. That gets the one real benefit the React frameworks offer without a rewrite.

### Gaps
- I collected no direct evidence (issues or benchmarks) for OpenNext or SolidStart Workers pain points in this session, so their dismissal rests on architecture and fit, not on cited defects.
- I found no first-party TanStack Start 1.0 announcement.

---

## Q8. Per-layer verdict for the remaster (summary of Q1–Q7)

### Takeaway
The stack's choices are sound. What is out of date is versions and one wrong pairing: Drizzle + postgres.js + `prepare: false` over Hyperdrive. Recommended remaster stack:
- SvelteKit 3 + Svelte 5.57 on adapter-cloudflare 8 (Vite 8), with remote functions and async treated as opt-in experiments
- Threlte 8.6, lazy-loaded
- Drizzle 0.45 with node-postgres (`pg`), one client per request, over two Hyperdrive configs (cached and uncached), with the Worker placed at `aws:us-east-1`
- Postgres kept: Supabase database-only short-term on Pro, with an optional move to PlanetScale Postgres
- Durable Objects (SQLite) in a separate Worker for game rooms and realtime
- Better Auth 1.7.x with the username and anonymous plugins
- Vitest 5 with browser mode, `@cloudflare/vitest-plugin`, Playwright 1.64, and a Postgres service container in CI

### Cited Findings
| Layer | Current in repo | Latest (2026-10-23) | Health | Known Workers issues | Better alternative? | Recommendation |
|---|---|---|---|---|---|---|
| Framework | Kit ^2.50 / Svelte ^5.54 / adapter-cloudflare ^7.2.8 | Kit 3.1.0, Svelte 5.57.2, adapter 8.0.1 ([npm](https://www.npmjs.com/package/@sveltejs/kit)) | Very active; 3.0 shipped 2026-10-01 | No DO exports (#13692); Vite 8/Rolldown bugs (#15960, #17271); `platform` removed in adapter 8 ([changelog](https://raw.githubusercontent.com/sveltejs/kit/main/packages/adapter-cloudflare/CHANGELOG.md)) | No (Q7) | Upgrade to Kit 3; remote functions and async are opt-in, still experimental ([docs](https://svelte.dev/docs/kit/remote-functions)) |
| 3D | Threlte core ^8.5.2 / extras ^9.13 / three ^0.183 | core 8.6.1, extras 9.22.3, three 0.186.1 ([npm](https://www.npmjs.com/package/@threlte/core)) | Active (releases Sept–Oct 2026) | None found (client-only) | No | Keep; lazy-load |
| DB access path | postgres.js 3.4.8, `prepare:false`, `end()` in waitUntil, Hyperdrive → Supavisor session | pg 8.23.1; postgres 3.4.9 ([npm](https://www.npmjs.com/package/pg)) | pg active; postgres.js slower cadence plus open workerd bugs | Drizzle + postgres.js over Hyperdrive "not currently supported" ([CF](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)) | Yes: `pg` | `pg` Client per request, no `end()`, two Hyperdrive configs (cached/uncached) ([CF caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)), `placement.region` near DB ([CF placement](https://developers.cloudflare.com/workers/configuration/placement/)) |
| Postgres host | Supabase us-east-1 via Supavisor | Supabase Pro $25+ ([pricing](https://supabase.com/pricing)); Neon Launch with no minimum ([pricing](https://neon.com/pricing)); PlanetScale PS-5 $5 / PS-10 $10 ([pricing](https://planetscale.com/pricing)) | All healthy | Supabase direct host is IPv6-only without the $4 add-on ([Supabase](https://supabase.com/docs/guides/platform/ipv4-address)) | PlanetScale is a better Cloudflare fit and price ([CF blog](https://blog.cloudflare.com/planetscale-postgres-workers/)) | Stay on Supabase DB-only (Pro) for the remaster; optional later move to PlanetScale |
| ORM | drizzle-orm ^0.45.1 / kit ^0.31.8 | 0.45.4 stable; 1.0.0-rc.5 ([npm](https://www.npmjs.com/package/drizzle-orm)) | Active; v1 RC for about 6 months | Prepare handling bug with postgres.js (#6096) ([GH](https://github.com/drizzle-team/drizzle-orm/issues/6096)) | No (Kysely, Prisma give no gain) | Keep 0.45 + node-postgres; upgrade to v1 at GA |
| Edge state | Supabase Realtime | DO SQLite: 10 GB per object, 1k req/s per object ([CF](https://developers.cloudflare.com/durable-objects/platform/limits/)) | GA | Not exportable from the SvelteKit Worker (#13692) | n/a | Separate DO Worker, bound with `script_name` |
| D1 | not used | 10 GB per DB, read replication still beta ([CF](https://developers.cloudflare.com/d1/platform/limits/)) | GA (replication beta) | 100 bound-params limit | No for main data | Don't adopt for core data |
| Auth | better-auth ~1.4.21 | 1.7.12; 1.8 beta ([npm](https://www.npmjs.com/package/better-auth)) | Strong (Vercel-owned since 2026-07-07) ([Vercel](https://vercel.com/blog/vercel-acquires-better-auth)) | Hang-on-aborted-init issues #10315, #11651 | No; switching risks password resets | Upgrade to 1.7.x; hashes compatible (same scrypt params); add anonymous plugin |
| Testing | Vitest ^4.1, Playwright ^1.58, integration tests manual | Vitest 5.0.5; Playwright 1.64.1; `@cloudflare/vitest-plugin` 1.4.7 ([npm](https://www.npmjs.com/package/@cloudflare/vitest-plugin)) | Active | pool-workers stuck on Vitest 4 | Yes: vitest-plugin replaces pool-workers | Vitest 5 + vitest-plugin for Workers code; Postgres service container in CI ([GitHub Docs](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)) |

### Inferences
**Highest-leverage change:** the driver switch (postgres.js → `pg`) plus deliberate Hyperdrive caching. It is small, follows explicit Cloudflare guidance, and targets the class of intermittent connection problems this app has already fought.

**Suggested order:**
1. Driver switch and Hyperdrive configs. This can happen on Kit 2 today.
2. Better Auth 1.4 → 1.7.
3. Kit 3 / Vite 8 / Vitest 5 migration with `sv migrate sveltekit-3`. Fix `platform` → `cloudflare:workers` env and ctx, and `$lib` → `#lib`.
4. DO game Worker plus R2 media.
5. Optional database host move.

**Kit 3 / Vite 8 caution:** watch #15960 (a CJS dependency using Node builtins crashes the Worker under Rolldown). This repo bundles several WASM/CJS-adjacent dependencies (`@jsquash/*`, `@resvg/resvg-wasm`, `postgres`/`pg`). Verify a production Worker build early in the migration.

### Gaps
- No single source compares these stacks on identical Workers workloads. The verdicts combine vendor docs, changelogs, issue trackers and pricing pages.
- Live-environment details I couldn't check from here:
  - which Supabase tier is in use
  - the current Hyperdrive config's caching setting
  - actual production query latencies
