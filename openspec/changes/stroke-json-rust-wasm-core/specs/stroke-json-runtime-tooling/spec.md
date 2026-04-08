## ADDED Requirements

### Requirement: Rust/WASM toolchain inputs are pinned and validated across environments
The system SHALL define a reproducible Rust/WASM toolchain contract for local, CI, and VPS builds, including committed lockfiles, a pinned Rust toolchain, the required `wasm32-unknown-unknown` target, and repo-managed `wasm-pack` version validation.

#### Scenario: Clean-clone validation rejects missing or mismatched Rust prerequisites
- **WHEN** a developer, CI job, or VPS host attempts to run a Rust/WASM-dependent check or build without the required Rust target or pinned `wasm-pack` version
- **THEN** the workflow fails clearly before the dependent build or test continues

#### Scenario: Locked Rust inputs are committed to the repo
- **WHEN** the workspace adds or updates Rust/WASM build logic
- **THEN** the repo includes the committed Cargo lockfile and pinned Rust toolchain configuration needed to reproduce those builds

### Requirement: Generated WASM artifacts have one authoritative build path
The system SHALL generate browser and server WASM artifacts only through a single root `stroke-json:wasm:build` entrypoint, and that entrypoint SHALL be the only command allowed to write into `packages/stroke-json-runtime/generated/wasm/`.

#### Scenario: Authoritative build writes browser and server outputs to the generated runtime directory
- **WHEN** `stroke-json:wasm:build` runs successfully
- **THEN** it emits the bundler-target browser and server WASM outputs under `packages/stroke-json-runtime/generated/wasm/`

#### Scenario: Generated artifacts are treated as build outputs, not hand-maintained source files
- **WHEN** a clean step or validation gate needs generated WASM artifacts
- **THEN** the artifacts are removed or regenerated through the authoritative build command rather than edited or refreshed by hand

### Requirement: Root workspace quality gates include Rust and runtime checks before web app validation completes
The system SHALL expand root workspace scripts so Rust formatting, linting, checking, testing, and WASM build generation participate in the same top-level gates as the web app.

#### Scenario: Root build depends on WASM generation before the web production build
- **WHEN** the root `build` script runs
- **THEN** it runs `stroke-json:wasm:build` before the web production build begins

#### Scenario: Root verification gates cover Rust, runtime, and web layers together
- **WHEN** the root `format`, `lint`, `check`, or `test` scripts run
- **THEN** they include the relevant Rust and runtime-package steps before the existing web-app steps are considered complete

### Requirement: Production install and deploy flows validate the bundled runtime before restart
The system SHALL require install and deploy automation to validate Rust prerequisites and prove that the built server runtime can initialize before the application service is restarted.

#### Scenario: Install fails clearly when required Rust tools are unavailable
- **WHEN** the production install flow runs on a host missing `rustc`, `cargo`, or `wasm-pack`
- **THEN** the install flow fails clearly instead of attempting an implicit Rust toolchain install

#### Scenario: Deploy validates the built server runtime before restart
- **WHEN** the production deploy flow runs
- **THEN** it performs a frozen dependency install, generates the WASM artifacts, builds the app, smoke-tests initialization of the bundled server runtime, and only then restarts the service

### Requirement: Demo/browser runtime adoption remains gated until a non-demo route depends on the runtime
The system SHALL keep a clean full-app build plus browser worker/WASM initialization smoke validation in place while the initial browser runtime consumer remains under `/demo/stroke-json`.

#### Scenario: Demo-only browser adoption keeps an extra smoke gate
- **WHEN** the browser runtime is only exercised by `/demo/stroke-json`
- **THEN** validation includes a clean full-app build that keeps demo routes plus a worker/WASM initialization smoke test for the browser path

#### Scenario: Product-route adoption can retire the demo-only gate
- **WHEN** a non-demo product route depends on the runtime and the production build exercises that dependency
- **THEN** the repo may replace the demo-only smoke gate with the product-route build and smoke validation that covers the same runtime behavior