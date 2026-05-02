# Devenv Local DX

**Date:** 2026-04-29
**Status:** Proposed

## Problem

Local development currently depends on contributors manually assembling the right toolchain and startup sequence across Bun workspace scripts, Rust tooling, and a Docker Compose based local Supabase stack. The repo already has good automation primitives, but the entrypoint is fragmented: contributors need to know which packages to install globally, which shell they need, which environment files are copied implicitly, and which commands need to be run in what order.

That increases setup friction, makes onboarding slower, and leaves too much room for machine-specific drift.

## Goal

Add `devenv` as the preferred local developer entrypoint so a contributor with `devenv` installed can:

- enter a reproducible project shell with the required toolchains available
- start the standard local development stack with one command
- run the existing quality gates from the same environment
- keep using the repo's current Bun scripts as the source of truth instead of duplicating workflow logic

## Scope

This change will define:

- Linux-first support boundaries for the initial `devenv` rollout
- the repo-level `devenv` configuration for local development
- which toolchains and CLI dependencies are provided through `devenv`
- how `devenv` maps to the existing Bun workspace scripts
- how `devenv` starts the Svelte app and the existing local Supabase stack
- the README guidance for contributors who want to use the new DX path

This change will not:

- guarantee first-pass support for macOS or Windows contributors
- replace Docker Compose with Nix-managed Supabase services
- change CI to require `devenv`
- remove or rename the existing Bun scripts
- redesign application build, test, or database workflows
- change production deployment strategy

## Alternatives Considered

### A. Thin Toolchain Wrapper

Use `devenv` only to install Bun, Rust, Node, and helper CLIs, while keeping all runtime orchestration manual.

Pros:

- minimal repo change
- low risk to existing workflows

Cons:

- still leaves service startup fragmented
- does not deliver a true one-command local entrypoint

### B. Devenv As The Main Local Entry Point

Use `devenv` to provide toolchains, named tasks, and a standard `up` workflow while keeping Docker Compose as the backing service runtime.

Pros:

- improves onboarding and reproducibility without replacing existing infra
- keeps Bun scripts as the workflow source of truth
- additive and low-risk for contributors who do not want to adopt `devenv` immediately

Cons:

- adds a Nix-based local dependency for contributors who choose this workflow
- introduces one more repo-level config surface to maintain

### C. Full Nix-Managed Local Infra

Use `devenv` to replace more of the local service model, including parts of the Compose-backed Supabase stack.

Pros:

- stronger consolidation under one tool

Cons:

- much larger migration
- higher maintenance burden
- unnecessary churn given the repo already has a working Compose stack

## Recommended Approach

Adopt option B.

`devenv` should become the preferred local DX shell and process launcher, while Docker Compose remains the underlying way the repo runs the local Supabase stack. This keeps the current infrastructure model intact and improves the day-to-day workflow by standardizing the outer layer: toolchains, helper commands, and the canonical entrypoint.

The first pass is explicitly Linux-first. The repo may still work on other platforms through the existing direct Bun and Docker Compose workflow, but `devenv` support and validation for this change target Linux only.

At a high level:

```text
devenv shell -> reproducible project toolchain
devenv tasks -> wrapper around existing bun scripts
devenv up -> app process + compose-backed local services
```

## Architecture

### Responsibility Split

- `package.json` scripts remain the source of truth for build, lint, test, and database actions.
- `compose.yaml` remains the source of truth for the local Supabase stack.
- `devenv` becomes the source of truth for local environment provisioning, common task discovery, and the preferred startup entrypoint.

This avoids duplicating business logic across two systems. `devenv` should orchestrate and expose what the repo already knows how to do rather than reimplementing it.

For this monorepo, `devenv` tasks should invoke the root workspace scripts from the repository root unless there is a documented reason to target `apps/web` directly. The root scripts already delegate to the correct workspace package when needed, so they are the preferred contract for `devenv` integration.

### Toolchain Provisioning

The `devenv` shell should provide the minimum set of tools required to run the repo predictably on Linux:

- Bun
- Node.js
- Rust toolchain support used by workspace scripts and crates
- Docker CLI and Docker Compose integration expected by the local Supabase workflow
- `git`
- `sh`/core shell utilities used by repo scripts
- `curl` and `wget`, which are already used in local service health checks and common diagnostics

If `devenv` can reliably provide Bun directly, use that. If not, fall back to the cleanest supported package source rather than adding custom bootstrap steps.

Version policy for the first pass:

- Rust should follow the repository's existing `rust-toolchain.toml`.
- Bun should be pinned explicitly in `devenv.nix` to a known compatible release and reviewed alongside lockfile or toolchain updates.
- Node.js should be pinned explicitly in `devenv.nix` to a current LTS release because the repo does not yet define a canonical Node version elsewhere.

This does introduce a version declaration for Bun and Node in `devenv`, but that is acceptable in the first pass because the repo does not already provide a stronger canonical source for those runtimes.

### Docker Boundary

`devenv` must not be treated as the provider of the Docker daemon.

- Docker Engine remains a host prerequisite managed outside the repo.
- `devenv` only provides the client-side tools needed to talk to that daemon, such as `docker` and Compose support.
- README setup instructions must call out that `devenv` users still need a running Docker daemon on the host.

This boundary is required because the local Supabase workflow depends on `docker compose`, and that dependency cannot be hidden by the shell alone.

### Process Model

The initial process model should stay intentionally simple.

- One long-running process should run the web app through the existing root-level `bun run dev` workflow from the repository root.
- Local Supabase services should still be started through the existing `bun run db:start` wrapper, which already handles the `.env.supabase` bootstrap behavior.
- Stopping the app process under `devenv` should not silently tear down the Compose stack unless that behavior is explicitly configured and verified.
- The documented cleanup path for the first pass should be explicit: stop the interactive `devenv` processes, and use the root-level `bun run db:stop` task when the developer wants to tear down local Supabase services.

This means the first pass favors reliable startup and discoverability over deep custom orchestration.

### Environment Variable Strategy

The first pass should avoid inventing new env-loading behavior.

- Root-level `bun run db:start` and related scripts remain responsible for the existing `.env.supabase` bootstrap behavior.
- Application-specific env files such as `apps/web/.env` remain user-managed and are not auto-generated by `devenv`.
- `devenv` may provide non-secret convenience defaults only when they do not conflict with the repo's documented env files.

The shell should not silently source arbitrary project env files behind the user's back. The goal is reproducible tooling and command discovery, not a hidden second env system.

## Developer Workflow

The preferred local flow becomes:

1. install `devenv`
2. enter the repo and run `devenv shell` for an interactive shell, or `devenv up` for the standard local stack
3. use `devenv tasks run <name>` or documented shortcuts for common commands such as `dev`, `db:start`, `db:stop`, `db:reset`, `format`, `lint`, `check`, and `test`

Important rule: the command behavior should continue to come from the existing Bun scripts. A contributor who runs `bun run check` directly and a contributor who runs the corresponding `devenv` task should hit the same underlying logic.

The `devenv` task layer should stay shallow. Representative mappings:

- `dev` -> run root-level `bun run dev`
- `db:start` -> run root-level `bun run db:start`
- `db:stop` -> run root-level `bun run db:stop`
- `format` -> run root-level `bun run format`
- `lint` -> run root-level `bun run lint`
- `check` -> run root-level `bun run check`
- `test` -> run root-level `bun run test`

The exact `devenv.nix` syntax can follow the current `devenv` release in use, but the design requirement is that each task is a thin wrapper around one existing root command, not a rewritten workflow.

## Configuration Shape

The change should add a small, additive repo surface:

- root-level `devenv.nix` as the main configuration file for packages, env defaults, tasks, and processes
- optional `devenv.yaml` only if needed by the chosen `devenv` version or imports model
- optional `.envrc` only if the team wants automatic shell activation through `direnv`
- README updates explaining how `devenv` maps onto the existing workflow

The repo should continue to work for contributors who use Bun and Docker Compose directly without `devenv`.

If `.envrc` is added, it must remain optional and non-blocking. Contributors who do not use `direnv` should still be able to use `devenv shell` and `devenv up` directly.

Because this repository also contains Rust crates outside the Bun workspace, `devenv` must be defined from the repository root and validated from that root. The PATH and working directory assumptions should be optimized for root-level commands that transitively invoke both Bun workspace packages and Cargo workspace crates.

## Validation And Success Criteria

The first pass is successful when a clean Linux machine with `devenv` installed can:

- enter the repo and get a working shell with the required toolchains available
- start local development with one command
- run `format`, `lint`, `check`, and `test` inside the managed environment
- start and stop the local Supabase stack without additional undocumented manual setup

The repo's existing quality gates remain the canonical post-change validation steps:

- `bun run format`
- `bun run lint`
- `bun run check`
- `bun run test`

Validation process for the first implementation pass:

1. enter the managed shell from the repository root
2. confirm the expected toolchain binaries resolve from that shell
3. run the root-level `dev` and `db:start` workflows through `devenv`
4. run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` from the same shell

This explicitly verifies that the Bun workspace and Cargo workspace still behave correctly under the managed environment.

## Risks And Mitigations

### Toolchain Drift Between Devenv And Existing Scripts

Risk:

The shell could expose tool versions that behave differently from what contributors already use manually.

Mitigation:

Keep `devenv` focused on provisioning and orchestration, and validate the repo using the existing root scripts after the configuration lands.

### Over-Orchestration In The First Pass

Risk:

Trying to fully manage Compose lifecycle semantics inside `devenv` could make the first iteration fragile.

Mitigation:

Use `devenv` as a wrapper around the existing `db:start` and `db:stop` scripts first. Only deepen orchestration later if actual pain remains.

### Optional Adoption Confusion

Risk:

Contributors may not know whether `devenv` is mandatory.

Mitigation:

Document it as the preferred DX path for local work while explicitly preserving the direct Bun and Docker Compose path.

## Implementation Notes

The implementation should stay additive and minimal:

- do not duplicate existing script logic inside `devenv`
- do not change CI in the first pass
- do not replace `compose.yaml`
- prefer a small set of named tasks over a large custom abstraction layer

This is a developer-experience change, not an infrastructure rewrite.