# VPS Production Deployment Implementation Plan

**Date:** 2026-03-31
**Status:** Proposed
**Design Reference:** `docs/superpowers/specs/2026-03-31-vps-production-deployment-design.md`

## 1. Production Runtime Switch

- [x] 1.1 Replace `@sveltejs/adapter-auto` with `@sveltejs/adapter-node` in `apps/web`, update `svelte.config.js`, and confirm the production artifact starts with `node build`.
- [x] 1.2 Add a focused build smoke test or validation script that fails if the production build no longer emits the expected Node entrypoint.
- [x] 1.3 Verify that the runtime still reads `HOST`, `PORT`, and `ORIGIN` correctly under the Node adapter and document any required proxy-related env defaults.

## 2. Deployment Templates And Runtime Contracts

- [x] 2.1 Add generated template sources for the `systemd` unit and Caddy site block under a dedicated deployment directory such as `scripts/deploy/templates/`.
- [x] 2.2 Implement template rendering so the service name, working directory, domain, email, host, and port are configurable without hand-editing generated files.
- [x] 2.3 Add automated checks for the generated `systemd` and Caddy outputs so invalid substitutions are caught before host-side writes.

## 3. Environment File Management

- [x] 3.1 Implement env parsing and writing utilities for `/etc/not-the-louvre/not-the-louvre.env` that preserve unrelated keys and emit shell-safe `KEY=VALUE` output.
- [x] 3.2 Implement env validation rules covering required keys, accepted Supabase aliases, exactly-one storage credential semantics, and production-safe `ORIGIN` validation.
- [x] 3.3 Add unit tests for env mutation, quoting/escaping, required-key detection, and restart gating on invalid configuration.

## 4. VPS Operator Script

- [x] 4.1 Add `scripts/deploy/vps.sh install` to validate prerequisites, create the service user idempotently, create directories, install generated config, validate Caddy, and enable services.
- [x] 4.2 Add `scripts/deploy/vps.sh deploy` to update code, run `bun install --frozen-lockfile`, run `bun run build`, validate runtime prerequisites, and restart the app service only on success.
- [x] 4.3 Add `scripts/deploy/vps.sh env:set` and `scripts/deploy/vps.sh env:edit` to update the production env file safely and restart only after successful validation.
- [x] 4.4 Add `scripts/deploy/vps.sh status` to report service state, env file presence, required-key health, configured domain, and Caddy validation status.
- [x] 4.5 Add `scripts/deploy/vps.sh uninstall` to disable and remove the service and proxy config while preserving secrets by default unless an explicit destructive flag is passed.

## 5. Documentation Updates

- [x] 5.1 Update `apps/web/.env.example` comments so production operators know which values are canonical, which aliases are tolerated temporarily, and which secrets must never reach the browser.
- [x] 5.2 Update the root README with a short production deployment section describing the VPS topology, required packages, env file location, and high-level install/deploy commands.
- [x] 5.3 Document rollback and recovery steps for failed deploys, including how to restore a previous working tree and restart the service.

## 6. End-To-End Operational Verification

- [ ] 6.1 Verify a clean-host install path on a disposable VPS or VM: install packages, run `install`, set env vars, run `deploy`, and confirm valid HTTPS at the configured domain.
- [ ] 6.2 Verify resilience behavior: reboot the host, confirm the app comes back automatically, stop the Node process, and confirm `systemd` restarts it.
- [ ] 6.3 Verify configuration operations: rotate a non-breaking env var through `env:set`, confirm a clean restart, then attempt an invalid env change and confirm the tooling blocks restart.

## 7. Validation

- [x] 7.1 Run `bun run format` and fix any formatting changes introduced by deployment tooling or config updates.
- [x] 7.2 Run `bun run lint` and resolve any lint failures caused by the new deployment code or templates.
- [x] 7.3 Run `bun run check` and resolve any type or Svelte diagnostics caused by the adapter/runtime switch.
- [x] 7.4 Run `bun run test` and resolve any failures caused by the deployment-related changes.
- [x] 7.5 Run a final production smoke build with `bun run build` and confirm the artifact boots locally with `HOST=127.0.0.1 PORT=3000 ORIGIN=http://localhost:3000 node build`.

## Delivery Notes

- Prefer implementing deployment utilities in small testable modules, with `vps.sh` acting mainly as orchestration.
- Do not store production secrets in the repository or generate them into tracked files.
- Keep the MVP rollback path simple: restore the previous working tree or release directory, restore the prior env file if needed, and restart the service.