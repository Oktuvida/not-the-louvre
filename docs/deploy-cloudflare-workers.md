# Deploying to Cloudflare Workers

The web app (`apps/web`) deploys to **Cloudflare Workers with static assets** via
`@sveltejs/adapter-cloudflare`. CI deploys automatically on every push to `main`
(`.github/workflows/deploy.yml`).

## Why Workers and not Pages

Cloudflare now recommends Workers (static assets) over Pages for new SvelteKit
projects, and the same adapter targets both. The app relies on WebAssembly in two
places, both of which run on `workerd`:

- **stroke-json runtime** — the Rust-built drawing-document WASM
  (`packages/stroke-json-runtime`).
- **Image pipeline** — `sharp` was replaced with WASM codecs (`@jsquash/*` for
  AVIF/WebP/PNG/JPEG decode-encode and resize, `@resvg/resvg-wasm` for
  SVG→raster), because `sharp` is a native Node addon that cannot run on Workers.

`workerd` forbids compiling WASM from bytes at runtime, so every `.wasm` import is
kept external in the Vite build (`build.rollupOptions.external`) and bundled by
Wrangler as a `WebAssembly.Module`. In Node (tests, `vite preview`) the same code
reads the bytes from disk instead. The branch is chosen at runtime by detecting
`caches.default`.

## One-time Cloudflare setup

1. Create the Worker (the first `wrangler deploy` does this) — its name is
   `not-the-louvre` in `apps/web/wrangler.jsonc`.
2. Set runtime secrets (NOT committed; these are read via `$env/dynamic/private`):

   ```sh
   cd apps/web
   wrangler secret put DATABASE_URL
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put SUPABASE_PUBLIC_URL
   wrangler secret put SUPABASE_SECRET_KEY
   wrangler secret put SERVICE_ROLE_KEY
   wrangler secret put ARTWORK_STORAGE_BUCKET   # e.g. "artworks"
   wrangler secret put ORIGIN                   # public https origin of the deployment
   ```

   (Match the keys in `apps/web/.env.example`. `JWT_SECRET`/`SUPABASE_JWT_SECRET`
   too if your auth config reads it.)

3. **Database connectivity**: the Worker connects to Postgres over TCP using
   `postgres.js` + the `nodejs_compat` flag (already set in `wrangler.jsonc`).
   Each request opens and closes its own connection because Workers cannot share
   a socket across requests (see `runWithRequestDbConnection` in
   `src/lib/server/db/index.ts`). For production throughput, front the database
   with **Cloudflare Hyperdrive** and point `DATABASE_URL` at the Hyperdrive
   connection string to get pooling and reduced latency.

4. **CPU limits**: AVIF encoding in WASM costs seconds of CPU per upload. This
   needs the Workers **paid** plan (the free plan caps at 10 ms). Raise the limit
   in `wrangler.jsonc` via `limits.cpu_ms` if uploads time out.

## GitHub Actions secrets

Set these on the repository (Settings → Secrets and variables → Actions), ideally
scoped to a `production` environment:

| Secret                  | What it is                                                        |
| ----------------------- | ----------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token with the **Edit Cloudflare Workers** template permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                                        |

The deploy job needs neither Rust nor a database: the stroke-json WASM is
committed under `packages/stroke-json-runtime/generated`, and the SvelteKit build
reads runtime env lazily (`$env/dynamic/private`), so it builds without secrets.

## Local preview against the Worker runtime

```sh
cd apps/web
# Put real values in .dev.vars (gitignored) — same keys as the secrets above.
bun run build           # from repo root: `bun run build`
bunx wrangler dev       # serves the worker on http://localhost:8787
```
