# VPS Production Deployment

**Date:** 2026-03-31
**Status:** Proposed

## Problem

The initial production deployment target is a single hardened VPS with only port 443 exposed publicly. The app should remain operationally simple, restart automatically after machine reboots or process failures, terminate HTTPS with a valid certificate, and run an optimized production build rather than a development server.

The current app uses SvelteKit with `adapter-auto`, local development expects Bun workspace scripts, and the product depends on externally managed Supabase services for database, storage, and realtime. There is no CI pipeline yet, so the VPS must also build the project before running it.

## Goal

Deploy the app to one VPS using the smallest practical set of moving parts while preserving:

- automatic startup after reboot
- automatic restart after failure
- HTTPS on port 443 with automated certificate provisioning and renewal
- production-grade SvelteKit runtime
- server-managed secrets outside the repository
- a repeatable install, deploy, env update, and uninstall workflow

## Scope

This change will define:

- the production runtime architecture for a single VPS
- the required app adapter/runtime shape for production
- the environment variable model for production
- which values are intentionally exposed to the browser today
- the Caddy domain and TLS configuration model
- the responsibilities and interface of an install/deploy/env-management script

This change will not:

- introduce Docker or container orchestration for the MVP
- introduce CI/CD automation
- move Supabase services onto the VPS
- add multi-instance deployment or horizontal scaling
- redesign application auth, storage, or database logic

## Recommended Approach

Use `Caddy + systemd + SvelteKit adapter-node` with host-side builds.

```text
Internet :443 -> Caddy TLS termination -> reverse proxy -> Node SvelteKit server on 127.0.0.1:3000
                                                      |
                                                      -> systemd-managed process
Node app -> managed Supabase services over outbound network
```

This is preferred over Docker for the MVP because:

- the VPS hosts only one app
- Supabase is already externalized
- restart behavior is handled natively by `systemd`
- TLS is handled natively by Caddy
- operational surface area stays small and inspectable

## Architecture

### Runtime Topology

- `Caddy` is the only public-facing service and listens on port `443`.
- The SvelteKit app listens only on `127.0.0.1:3000`.
- `systemd` owns the app process lifecycle.
- The app runs as a dedicated non-login service user.
- The host builds the project, but the long-running process is the compiled production server, not `bun dev`.

### App Runtime Choice

The app should switch from `adapter-auto` to `adapter-node` for production deployment on the VPS.

Rationale:

- the host environment is known and stable
- the runtime is a traditional long-lived Node process
- `adapter-node` gives an explicit server artifact suitable for `systemd`
- production behavior becomes predictable and decoupled from adapter auto-detection

With default adapter settings, the production output directory is `build`, and the runtime command is:

- `node build`

This is the canonical startup form for the MVP unless the adapter output directory is customized later.

### Filesystem Layout

Recommended layout on the VPS:

- `/opt/not-the-louvre/current` — checked-out repository and current working tree
- `/etc/not-the-louvre/not-the-louvre.env` — production environment file
- `/etc/systemd/system/not-the-louvre.service` — app unit file
- `/etc/caddy/Caddyfile` — Caddy configuration

Optional later refinement:

- `/opt/not-the-louvre/releases/<timestamp>` for release directories and rollback support

For MVP, a single `current` directory is sufficient.

## Environment Variables

### Production Source of Truth

Production environment variables must live outside the repository in:

- `/etc/not-the-louvre/not-the-louvre.env`

The app service reads this file through `systemd` using `EnvironmentFile=`.

The production deploy flow must not depend on `apps/web/.env`.

The env file must be written in shell-compatible `KEY=VALUE` form. The env-management commands are responsible for safely quoting or escaping values so that `systemd` can parse them reliably.

Recommended permissions:

- owner: `root`
- group: service group such as `notthelouvre`
- mode: `0640`

### Required Variables

Required for this deployment model:

- `HOST=127.0.0.1`
- `PORT=3000`
- `ORIGIN=https://app.example.com`
- `DATABASE_URL=...`
- `BETTER_AUTH_SECRET=...`
- `SUPABASE_PUBLIC_URL=https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY=...`
- exactly one storage service credential: `SUPABASE_SECRET_KEY=...` or `SERVICE_ROLE_KEY=...`
- `SUPABASE_JWT_SECRET=...`

Optional with default:

- `ARTWORK_STORAGE_BUCKET=artworks`

Tolerated aliases in current application code:

- `PUBLIC_SUPABASE_URL` may be used as an alias for public Supabase URL in some server loads
- `PUBLIC_SUPABASE_ANON_KEY` and `ANON_KEY` may be used as aliases for anon key in some server loads

The deployment tooling should standardize on the canonical names `SUPABASE_PUBLIC_URL` and `SUPABASE_ANON_KEY`, but validation should treat the current aliases as acceptable until the application code is simplified.

### Security Classification

Server-only secrets:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `SUPABASE_SECRET_KEY` or `SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

Public-by-design values:

- `SUPABASE_PUBLIC_URL`
- `SUPABASE_ANON_KEY`
- `ORIGIN`

Operational runtime values:

- `HOST`
- `PORT`
- `ARTWORK_STORAGE_BUCKET`

### What Reaches the Client Today

The repo does not currently import public environment modules directly into browser components. However, server load functions intentionally serialize a small realtime config to the browser.

Currently exposed to the browser:

- Supabase public URL
- Supabase anon key

Current source locations:

- `src/routes/gallery/gallery-data.server.ts`
- `src/routes/demo/artwork-realtime-votes/+page.server.ts`

These values are returned as:

- `realtimeConfig.url`
- `realtimeConfig.anonKey`

These are acceptable to expose for browser-side Supabase realtime usage.

This transport remains valid after moving to `adapter-node` because the mechanism is ordinary server-side data serialization from SvelteKit load functions, not adapter-specific client env injection.

Not exposed to the browser and must remain server-only:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `SUPABASE_SECRET_KEY`
- `SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

Important rule: `PUBLIC_` naming is not the only browser exposure path. Any server `load` or endpoint can serialize a supposedly private value into the client payload if implemented incorrectly. The trust boundary is the returned server payload, not only the env var prefix.

## Domain and TLS

### Domain Model

The deployment assumes one production hostname, for example:

- `app.example.com`

Requirements:

- the DNS `A` or `AAAA` record points to the VPS
- no other process occupies port `443`
- `ORIGIN` exactly matches the public HTTPS origin

### Caddy Configuration

Minimal recommended Caddy configuration:

```caddy
{
	email ops@example.com
}

app.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
```

This is intentionally minimal for MVP.

Effects:

- automatic certificate issuance
- automatic renewal
- TLS termination on port `443`
- reverse proxy to the app's local port

This works with the current firewall constraint because Caddy can use certificate validation over port `443`.

### Domain Changes

Changing domains later requires:

1. updating DNS
2. updating the Caddy site block
3. updating `ORIGIN`
4. reloading Caddy and restarting the app

## Service Management

### systemd Unit

The Node server should be managed by a dedicated unit such as `not-the-louvre.service`.

Expected characteristics:

- non-root service user
- `WorkingDirectory` pointed at `apps/web`
- `EnvironmentFile=/etc/not-the-louvre/not-the-louvre.env`
- `ExecStart=/usr/bin/node build`
- `Restart=always`
- enabled on boot
- logs flow to `journalctl` by default

Conceptual unit shape:

```ini
[Unit]
Description=Not The Louvre
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=notthelouvre
Group=notthelouvre
WorkingDirectory=/opt/not-the-louvre/current/apps/web
EnvironmentFile=/etc/not-the-louvre/not-the-louvre.env
ExecStart=/usr/bin/node build
Restart=always
RestartSec=5
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
```

Ownership expectations:

- the service user owns or can read the app directory and built artifacts
- the deploy operator may be `root` or a sudo-capable administrative user
- the service user only needs runtime read access plus any write permissions required by the app itself

Operational logging for MVP should rely on `journalctl -u not-the-louvre.service`, avoiding custom file log plumbing unless needed later.

### Restart Behavior

This design satisfies restart requirements in two ways:

- `systemd enable` restores the app after machine reboot
- `Restart=always` restores the app after process exit or crash

## Deploy Flow

Because there is no CI yet, the VPS performs both build and runtime duties.

Recommended deploy flow:

1. update repository contents in `/opt/not-the-louvre/current`
2. from repository root, run `bun install --frozen-lockfile`
3. from repository root, run `bun run build`
4. restart the `systemd` service
5. verify service health and Caddy routing

Operational separation remains important:

- Bun is the install/build tool
- Node is the runtime for the deployed server process

The long-running service must never use `bun dev`.

Host package validation should require a modern Node runtime compatible with current SvelteKit output. For the MVP, the install tooling should require Node 20 or newer.

## Installer Script Design

### Script Shape

Provide one administrative script with subcommands, for example:

```bash
scripts/deploy/vps.sh install
scripts/deploy/vps.sh deploy
scripts/deploy/vps.sh env:set KEY=value
scripts/deploy/vps.sh env:edit
scripts/deploy/vps.sh uninstall
scripts/deploy/vps.sh status
```

The script should be idempotent where practical.

### install

Responsibilities:

- validate root privileges when required
- install or validate required host packages
- create service user and app directories
- create `/etc/not-the-louvre`
- create the env file if missing
- write or update the `systemd` unit
- write or update the Caddy configuration
- validate the Caddy configuration
- enable and start the app service
- enable and reload Caddy

Inputs:

- `DOMAIN`
- `LETSENCRYPT_EMAIL`
- optional app path and service user overrides

Idempotency rules:

- if the service user already exists, reuse it rather than failing
- if the service group already exists, reuse it rather than failing
- do not assume a fixed UID or GID
- create the service user as a non-login account without granting unnecessary supplemental groups

### deploy

Responsibilities:

- update application code on the host
- install dependencies
- build the app in production mode via the workspace root build command
- restart the app service
- fail fast if required env vars are missing
- print post-deploy status summary

This command should not rewrite secrets unless explicitly asked.

Validation rules:

- require `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`, `SUPABASE_JWT_SECRET`
- require at least one public Supabase URL name: `SUPABASE_PUBLIC_URL` or `PUBLIC_SUPABASE_URL`
- require at least one anon key name: `SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_ANON_KEY`, or `ANON_KEY`
- require exactly one server storage credential name: `SUPABASE_SECRET_KEY` or `SERVICE_ROLE_KEY`
- default `HOST` and `PORT` if omitted

Minimum validation depth for MVP:

- syntax validation: all required keys present and non-empty after parsing
- origin validation: `ORIGIN` must parse as an absolute `https://` URL in production
- secret validation: `BETTER_AUTH_SECRET` and `SUPABASE_JWT_SECRET` must meet a minimum length threshold suitable for production use
- config validation: `caddy validate` must pass before reloading Caddy
- service validation: the app service must return to an active state after restart

Out of scope for MVP deploy validation:

- live database connectivity probes during every env update
- certificate chain inspection beyond successful Caddy provisioning

### env:set

Responsibilities:

- update one or more keys in `/etc/not-the-louvre/not-the-louvre.env`
- preserve unrelated keys
- write shell-safe values
- validate required minimum configuration after modification
- restart the app only if validation succeeds

### env:edit

Responsibilities:

- open the env file in `$EDITOR`
- validate required keys after edit
- restart the app only on valid configuration

### uninstall

Responsibilities:

- stop and disable the app service
- remove the `systemd` unit
- remove or disable the Caddy site block
- optionally preserve the env file by default
- support a destructive confirmation flag for full removal

Default behavior should preserve secrets unless the operator explicitly requests deletion.

### status

Responsibilities:

- show `systemd` service status
- show whether the required env file exists
- verify presence of required env keys
- validate the active Caddy configuration
- print the configured domain and upstream port

## Host Dependencies

The host should provide:

- `git`
- `node` 20+
- `bun`
- `caddy`

No Docker dependency is required for the MVP deployment.

## Error Handling and Safety

The install/deploy tooling should fail safely in these cases:

- required env vars missing
- Caddy configuration invalid
- app build failure
- service restart failure
- domain config provided but `ORIGIN` mismatched

Safety expectations:

- do not overwrite an existing env file without explicit operator intent
- do not restart into a known-invalid configuration
- do not delete the env file on uninstall unless explicitly requested
- print actionable error messages instead of partial silent success

## Testing Strategy

### Manual Verification

Before declaring the deployment workflow complete:

1. install on a clean VPS
2. set production env vars through the script
3. deploy the app and confirm the service is healthy
4. visit the production domain and confirm valid HTTPS
5. reboot the VPS and confirm the app returns automatically
6. stop the Node process and confirm `systemd` restarts it
7. rotate one env var through `env:set` and confirm the app restarts cleanly
8. run uninstall and confirm service/config removal behavior matches the preservation policy

### Code-Level Verification

Implementation should include tests where practical for:

- env file mutation logic
- required-key validation logic
- generated Caddy config rendering
- generated `systemd` unit rendering

Shell-level commands that change the host system are best validated through controlled manual or VM-based integration testing.

## Rollout Plan

1. switch production adapter from `adapter-auto` to `adapter-node`
2. add the deployment script and generated config templates
3. document required env vars and production install steps
4. provision the VPS and DNS
5. run `install`
6. set production env vars
7. run `deploy`
8. verify HTTPS and restart behavior

If a deploy fails after build or restart, the immediate recovery path for MVP is:

1. restore the previous working tree or release directory contents
2. restore the prior env file if it was changed
3. restart the service
4. confirm the site is healthy through Caddy

Formal multi-release rollback automation can be added later if deployments become more frequent.

## Alternatives Considered

### Docker Compose with Caddy

Rejected for MVP because it increases operational complexity without solving a pressing problem. The app is the only workload on the VPS and stateful services already live outside the host.

### Nginx + Certbot + systemd

Rejected as the preferred option because it adds more operational components than Caddy for the same MVP outcome.

### Running Bun as the Long-Lived Production Server

Rejected as the primary design because the target deployment shape is a conventional compiled Node server under `systemd`. Bun remains useful as the build tool on the host.

## Open Questions

None for the MVP deployment design. The runtime, TLS, env model, and operator workflow are all settled enough to move into implementation planning.