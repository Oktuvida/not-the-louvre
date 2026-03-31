# Drawing Document Product Adoption

**Date:** 2026-03-30
**Status:** Proposed

## Context

The repo now has a validated research direction for stroke-json editing, but the
product requirements and product flows still describe a bitmap-first model.
Avatar and artwork creation currently treat raster media as the primary payload
crossing the backend boundary, which preserves the degradation problem we want
to remove.

The product decision is now explicit:

- no production compatibility path is required yet
- avatar and artwork both move to the new model
- the editable source becomes a versioned JSON drawing document
- the backend persists only final confirmed state
- the client may keep local drafts for recovery
- confirms stay synchronous in MVP

This design covers product adoption, not just the demo.

## Goals

- Replace the bitmap-first editing model with a shared drawing-document model in
  avatar and artwork flows.
- Preserve image derivatives for gallery, detail views, and texture-backed
  rendering surfaces.
- Eliminate cumulative degradation across avatar re-edit and artwork forking.
- Keep MVP operationally simple: no backend draft persistence, no async render
  queue, and no compatibility path for pre-JSON content.
- Reuse one shared core for document validation, compression, replay, and media
  derivation across both surfaces.

## Non-Goals

- Supporting old bitmap-only content through a compatibility layer.
- Reconstructing JSON source from raster media.
- Introducing background jobs or queue infrastructure for confirm-time rendering.
- Expanding the drawing feature set beyond the current constrained toolset.
- Designing a public draft-sharing or cross-device draft sync capability.

## Decision Summary

Adopt a shared drawing-document core with surface-specific wiring.

- Avatar and artwork use the same document lifecycle, validation strategy,
  compression model, and replay pipeline.
- Each surface keeps its own dimensions, limits, and route wiring.
- The editable source is always the drawing document.
- The persisted image remains a derived AVIF artifact.

This keeps one model of truth while still allowing product-specific constraints
for avatar and artwork.

## Versioning Strategy

The drawing document is explicitly versioned.

- MVP ships with schema version `1`
- backend confirm flows accept only supported schema versions
- client drafts are keyed by surface, user, and schema version so incompatible
  drafts are ignored instead of silently reused
- MVP does not attempt automatic migration of local drafts across schema changes
- if a future schema version is introduced, migration must be an explicit
  follow-up change rather than implied behavior

## Architecture

The product gains a transversal capability called `drawing document`, used by
avatar and artwork.

That capability defines:

- versioned JSON document structure
- schema validation and aggregate limits
- gzip-compressed persistence representation
- replay to canvas
- synchronous derived-image rendering during confirm

Avatar and artwork stop accepting raster media as the primary editable input.
Creating, editing, and forking always operate on the drawing document. The
image is stored only as a derived artifact for read paths, cached delivery, and
surfaces that still need a bitmap texture.

The client may keep a local draft for avatar and artwork independently. The
backend persists only final confirmed entities.

## Data And Persistence

The backend persists two distinct artifacts for confirmed avatar and artwork
state:

1. The compressed drawing document as the editable source of truth.
2. The canonical AVIF derivative as the read-optimized media artifact.

Storage location is explicit:

- the compressed drawing document is stored directly in the primary product
  database record for the avatar or artwork
- the derived AVIF is stored in object storage and referenced from the product
  record by a stable storage path

For artworks:

- new publishes persist a fresh drawing document snapshot
- each fork persists a full independent snapshot of the parent document at fork
  time
- lineage remains metadata via `parent_id`, not a reconstruction dependency

For avatars:

- each save replaces the prior avatar drawing document and derived image

For drafts:

- drafts live only in client storage
- drafts are separated by user and surface
- drafts are not written to backend tables or storage

Because there is no production compatibility requirement, all create, fork, and
avatar-edit flows may assume drawing-document availability once this adoption is
released.

Initial operational limits should be inherited from the validated stroke-json
source design and enforced per surface. MVP baseline limits are:

- artwork dimensions fixed at 768x768
- avatar dimensions fixed at 340x340 for editing, with 256x256 AVIF derivative
- maximum compressed drawing document bytes: 128 KB
- maximum decompressed JSON bytes: 512 KB
- maximum strokes: 2,000
- maximum points per stroke: 2,000
- maximum total points: 50,000

These numbers may later be tuned from production evidence, but the product
adoption should ship with explicit backend-enforced bounds.

## Product Flow

Artwork creation, artwork forking, and avatar editing share the same product
sequence:

1. initialize or load a drawing document
2. allow the user to edit that document locally
3. retain an optional local draft for recovery
4. submit the drawing document on confirm
5. validate, compress, persist, and derive the image synchronously in backend
6. return success only when the write is fully consistent

Specific surface behavior:

- avatar reopens the full current avatar document for editing and replaces it on
  save
- artwork creation starts from a fresh empty artwork document
- artwork fork opens a full editable copy of the parent artwork document

Forking does not use a locked-background overlay model in the new architecture.
It is a true branch of the editable source.

## Backend Confirm Model

The MVP confirm path stays synchronous.

Client and server must share the same replay semantics.

- the replay algorithm used for client preview and for server-side derivation
  should come from the same product-owned drawing core wherever runtime allows
- parity tests should compare representative documents rendered in both
  environments to catch divergence early
- the backend-rendered AVIF is the canonical persisted output if a mismatch is
  ever observed

On confirm, the backend must:

1. authenticate the actor
2. validate the drawing document and limits
3. replay the validated source into a canonical raster surface using a
   product-owned server-side canvas renderer
4. sanitize and upload the AVIF derivative to object storage
5. write the compressed drawing document and derivative storage reference in the
   product database record
6. return success only if the storage write and database write are both coherent

If any persistence step fails, the system must avoid partial entities and apply
compensating cleanup where necessary.

Transaction and cleanup rules are explicit:

- the database write is the final commit point for new artworks and avatar
  replacements
- if AVIF upload fails, the request fails before any database mutation
- if AVIF upload succeeds but the database write fails, the backend must delete
  the newly uploaded AVIF before returning failure
- if that delete also fails, the request still fails, the object remains
  unreferenced, and the backend must emit durable structured error logging for
  operator cleanup or a later sweeper job
- avatar replacement should not delete the previous derivative until the new
  document and new derivative reference are committed successfully
- after a successful avatar replacement commit, cleanup of the old avatar image
  may happen immediately in the same flow or as tightly scoped follow-up cleanup
  owned by the request

This approach is intentionally preferred over an async queue in MVP because it
keeps the operational model simple and does not require extra infrastructure.

## Operational Rules

- The drawing document is the only editable source of truth.
- Derived AVIF is never re-imported as the editing source.
- Backend validation must happen before replay or persistence.
- Undo/redo may exist in the client UX, but it remains transient UI state and
  is not persisted as part of the drawing document in MVP.
- Client drafts must be namespaced by user id, surface type, and drawing
  document schema version.
- Fork reconstruction must never require access to the parent document.
- Confirm failures must leave the local draft intact for retry.
- Stored AVIF derivatives are immutable snapshots produced at confirm time; MVP
  does not attempt retroactive re-rendering when replay code changes.

## Risks And Trade-offs

- Confirm latency may increase because derivative rendering is synchronous.
  Mitigation: keep the rendering path simple and bounded for MVP.
- Backend now owns both document persistence and media derivation in one flow.
  Mitigation: keep compensating cleanup explicit and well-tested.
- Shared core can still drift if avatar and artwork add custom logic directly in
  their UI flows. Mitigation: keep document handling, compression, replay, and
  validation in one reusable feature module.
- Local drafts can become stale or collide across users if storage keys are too
  coarse. Mitigation: namespace by user id, surface, and document version.

## Testing Strategy

Coverage should exist at four levels:

1. Pure document tests for schema, limits, compression, replay helpers, and
   local-draft keying.
2. Backend tests for confirm success, confirm failure, compensating cleanup, and
   fork snapshot persistence.
3. Route and action tests for avatar save, artwork publish, and artwork fork
   flows using the drawing document contract.
4. Browser journeys for creating artwork, forking without cumulative loss, and
   re-editing avatar without quality degradation.

The PRD must describe JSON drawing documents as the primary editing contract and
AVIF as the derived delivery artifact, not as the client-authored source.

## Rollout Shape

This adoption should be implemented as one architectural core plus two product
surface integrations:

1. establish shared drawing-document persistence and derivation primitives
2. wire avatar save and re-edit onto the new model
3. wire artwork create and fork onto the same model
4. update read-path assumptions and tests to consume the new persisted shape

Because there is no production compatibility requirement, the rollout can be a
clean replacement rather than a hybrid migration.

## Open Questions

- Whether undo/redo should later be represented inside the document lifecycle or
  remain purely transient client state.
- Whether local drafts should expire automatically after confirm or after a
  shorter inactivity window.