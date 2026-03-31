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

### ✨ Features, allegedly

- 🖌️ **A deeply serious drawing tool**: You get a brush, an eraser, and a few colors. That's it. No layers, no shapes, no bucket fill. If your vision depends on advanced tooling, perhaps your vision was weak.
- 🍴 **Forking, or tasteful art vandalism**: See something beautiful? Fork it, keep the original as a locked background, and add the moustache it was clearly missing. The full ancestry stays visible, so credit and blame are both preserved.
- 🎩 **Needlessly elegant 2.5D presentation**: Built with **Threlte**. The gallery glows, moves, and shows off like a millionaire's foyer. The artwork is still a flat little PNG. That mismatch is the whole point.
- 🍅 **Public curation with produce**: Upvote what deserves applause, downvote what deserves a tomato. Yes, the tomato actually drops on screen. We believe in responsive feedback.
- 🛡️ **Community-first moderation**: creators label sensitive work, viewers opt into 18+ reveals, and moderators can step in when a piece or profile crosses the line.

## 🛠️ The stack behind the nonsense

Because even a joke needs plumbing:
- **Frontend:** SvelteKit.
- **3D / Graphics:** Threlte + HTML5 Canvas 2D API.
- **Backend / Database:** Supabase.
- **Realtime:** Supabase Realtime.
- **Moderation:** DB-backed text policies, creator-applied NSFW labels, and persisted 18+ reveal gating.

## 📦 Repository layout

The repository now uses a small Bun workspace so the root stays focused on shared docs and infra.

```text
.
├── apps/
│   └── web/        # SvelteKit app
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
