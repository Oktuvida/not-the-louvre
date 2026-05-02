<p align="center">
  <img width="420" src="./assets/images/logo.svg" alt="Not The Louvre logo">
</p>


*[Leer en Español 🇪🇸](./README.es.md)*

> "A very expensive frame for a very questionable drawing."

Welcome to the classiest art institution on the internet, where the presentation says "national treasure" and the actual piece says "cat drawn in 40 seconds with a trackpad."

**Not The Louvre** is a community art party game built for the [Midudev Cubepath 2026 Hackathon](https://github.com/midudev/hackaton-cubepath-2026). You draw something, publish it, fork other people's work, and let the crowd decide whether you've made a masterpiece or a public embarrassment.

---

## 🧐 So what is it, really?

It's a museum sim for people whose artistic peak was doodling in MS Paint.

You open the app, sketch something mildly unhinged, hit publish, and wait for the public to either crown you the next genius or pelt your work with a perfectly justified tomato.

## ✨ Why it looks cool (Features & Tech)

- 🖌️ **A dazzling drawing tool**: You get a brush and a few colors. That's it. No layers, no shapes, no bucket fill. If your vision depends on advanced tooling, perhaps your vision was weak.
- 🍴 **Forking**: See a piece that's almost perfect? Fork it, keep the original as a locked background, and add the moustache it was clearly missing. The full ancestry stays visible so credit and blame are preserved.
- 🎩 **3D Navigation meets 2D Canvas (Threlte)**: We used Threlte so that navigating the app's routes feels like organically interacting with a 3D model of the studio. But when it's time to draw, we use the classic 2D Canvas API for maximum fluidity.
- 🍅 **Realtime Social Loop**: Votes and comments update live without refreshing the page, thanks to Supabase Realtime.
- 🧠 **Lossless JSON Drawing Documents**: To allow infinite forking without cumulative image degradation, the source of truth isn't a PNG. We store a versioned, compressed JSON document of brush strokes. When you fork, you clone the math, not the pixels.
- 🛡️ **Moderation & The inevitable "TTP" Metric**: In any public multiplayer drawing app, the *Time To Penis (TTP)* inevitably trends to zero. To manage this, we built a real moderation system from day one: creators can label work as NSFW (hidden behind an 18+ filter), and admins have quick shortcuts to censor unacceptable chaos.
- 📦 **Reproducible & Self-Hostable Infrastructure**

## 📦 Repository layout

The repository now uses a small Bun workspace so the root stays focused on shared docs and infra.

```text
.
├── apps/
│   └── web/        # SvelteKit app
├── devenv.nix      # Linux-first devenv shell, tasks, and processes
├── devenv.yaml     # Pinned devenv inputs
├── docs/           # Product and project docs
├── compose.yaml    # Local Supabase stack
├── .env.supabase.example
└── package.json    # Workspace scripts
```

- Run the local Supabase stack with `bun run db:start` and stop it with `bun run db:stop`.
- The first `bun run db:start` copies `.env.supabase.example` to `.env.supabase` if you have not customized it yet.
- Run the app from the repository root with `bun run dev`, `bun run check`, `bun run build`, etc.
- App-specific configuration now lives in `apps/web`.
- Environment files for the app now live in `apps/web/.env` and `apps/web/.env.example`.

## `devenv` workflow

This repo now includes a Linux-first `devenv` setup for local development. The direct Bun and Docker Compose workflow still works, but `devenv` is the preferred DX entrypoint.

Prerequisites:

- install `devenv`
- keep Docker Engine running on the host; `devenv` provides the client tooling, not the daemon

Typical flow from the repository root:

- `devenv shell` to enter the managed shell
- inside `devenv shell`, run `ntl:format`, `ntl:check`, `ntl:test`, and the other `ntl:*` commands directly
- `devenv up` to start the local Supabase stack, run database migrations, and then launch the app
- `devenv tasks run ntl:check` to run the root typecheck pipeline
- `devenv tasks run ntl:test` to run the root test pipeline
- `devenv tasks run ntl:db-stop` to stop the local Supabase stack when you are done

Useful task mappings:

- `ntl:dev` -> `bun run dev`
- `ntl:format` -> `bun run format`
- `ntl:lint` -> `bun run lint`
- `ntl:check` -> `bun run check`
- `ntl:test` -> `bun run test`
- `ntl:db-start` -> `bun run db:start`
- `ntl:db-stop` -> `bun run db:stop`
- `ntl:db-reset` -> `bun run db:reset`
- `ntl:db-migrate` -> `bun run db:migrate`

Notes:

- `devenv up` runs `ntl:db-start`, then `ntl:db-migrate`, and only then starts the app process.
- leaving `devenv up` does not automatically stop the Docker Compose stack; stop it explicitly with `devenv tasks run ntl:db-stop` or `bun run db:stop`.
- `devenv` does not auto-generate `apps/web/.env`; app env files remain user-managed.

## Production deployment

The MVP production target is a single VPS running:

- `Caddy` on `:443` for HTTPS termination and automatic certificate renewal
- the SvelteKit app as a `systemd` service on `127.0.0.1:3000`
- managed Supabase for database, storage, and realtime services

The production runtime uses `@sveltejs/adapter-node`, so the deployed server starts with `node build` after `bun run build` completes.

### Production env file

Production secrets should not live in the repository. Store them in an env file such as `/etc/not-the-louvre/not-the-louvre.env` and load that file through `systemd`.

Canonical keys:

- `ORIGIN=https://app.example.com`
- `DATABASE_URL=...`
- `BETTER_AUTH_SECRET=...`
- `SUPABASE_PUBLIC_URL=...`
- `SUPABASE_ANON_KEY=...`
- exactly one of `SUPABASE_SECRET_KEY=...` or `SERVICE_ROLE_KEY=...`
- `SUPABASE_JWT_SECRET=...`
- optional `HOST=127.0.0.1`, `PORT=3000`, `ARTWORK_STORAGE_BUCKET=artworks`

Values intentionally exposed to browser realtime clients today:

- `SUPABASE_PUBLIC_URL`
- `SUPABASE_ANON_KEY`

### VPS helper script

The repo includes a VPS helper at `scripts/deploy/vps.sh` with these subcommands:

- `scripts/deploy/vps.sh install --domain app.example.com --email ops@example.com`
- `scripts/deploy/vps.sh deploy`
- `scripts/deploy/vps.sh env:set KEY=value`
- `scripts/deploy/vps.sh env:edit`
- `scripts/deploy/vps.sh status`
- `scripts/deploy/vps.sh uninstall`

### Rollback

If a deploy fails after a build or restart:

1. restore the previous working tree or release directory contents
2. restore the previous env file if it changed
3. restart the app service
4. confirm the site is healthy through Caddy

## 📜 The philosophy

The whole idea is to get people from "I opened the browser" to "I published a ridiculous drawing" in under two minutes. No long onboarding, no solemn creative process, no paywall pretending to be a feature. Just draw, laugh, judge, repeat.

---
*Built with ❤️ and a medically unnecessary amount of caffeine for Cubepath 2026.*
