# WebP Canvas Ingress Contract

**Date:** 2026-03-29
**Status:** Proposed

## Problem

The product currently documents multiple client-to-backend image contracts for
canvas-generated media. Some sections describe avatar uploads as PNG-only,
others describe artwork canvases as browser-exported AVIF, and persisted media
is still expected to be canonical AVIF after backend sanitization. That leaves
the product contract internally inconsistent and pushes too much size risk onto
browser-side canvas export.

For simple hand-drawn canvas artwork and avatars, hitting the 100KB media budget
is more important than preserving high-fidelity source quality. The product
needs one ingress format that keeps uploads small, preserves transparency, and
remains distinct from the canonical storage and delivery format.

## Decision

Unify all canvas-to-backend media interactions around compressed WebP.

The product media contract becomes:

- `front -> back`: compressed WebP
- `back -> persistence`: canonical AVIF
- `back -> front`: canonical AVIF

This applies to canvas-generated avatars and canvas-generated artwork.

## Goals

- Replace PNG as the documented browser upload format for avatars.
- Replace browser-exported AVIF as the documented upload format for artwork.
- Keep AVIF as the only canonical persisted and delivered media format.
- Make the size budget explicit as a product concern for both avatar and
  artwork flows.

## Non-Goals

- Redefining storage, caching, or delivery away from AVIF.
- Expanding this contract to non-canvas uploads outside current avatar and draw
  flows.
- Documenting browser-specific fallback behavior as part of the product
  contract.

## Product Contract

### Avatar Flow

- The browser exports avatar canvas content as compressed WebP before upload.
- The backend validates that the upload decodes as a single still image at the
  avatar canonical dimensions.
- The backend re-encodes the accepted upload to canonical AVIF for storage.
- Avatar reads from the backend remain AVIF.

### Artwork Flow

- The browser exports draw-canvas content as compressed WebP before publish.
- The backend validates that the upload decodes safely and can be normalized
  into the canonical artwork dimensions.
- The backend re-encodes the accepted upload to canonical AVIF for storage.
- Artwork reads from the backend remain AVIF.

## Rationale

WebP is the right ingress format for this product because it preserves
transparency while producing materially smaller uploads than PNG for simple
canvas drawings. That makes it a better match for a hard media budget of
roughly 100KB per stored image. It also avoids relying on browser-side AVIF
encoding as part of the primary product contract.

This separation of concerns keeps the system easier to reason about:

- WebP is the browser-facing upload contract for canvas output.
- AVIF is the backend-owned canonical format for storage and delivery.
- The backend remains the single sanitization boundary.

## Documentation Impact

The PRD should be updated so these statements are all true at once:

- Avatar ingress is no longer PNG-only.
- Canvas export is no longer described as browser-side AVIF.
- The canvas media pipeline is expressed once as WebP ingress and AVIF egress.

Historical design docs that mention PNG avatar ingress or browser-side AVIF
export should be treated as superseded by this contract decision rather than as
the current product source of truth.

## Implementation Impact

This design implies follow-up implementation work in both product surfaces and
backend validation:

- Avatar canvas export should emit compressed WebP instead of PNG or AVIF.
- Draw-route canvas export should prefer compressed WebP as its primary upload
  payload.
- Backend avatar and artwork ingress validation should accept WebP as the
  expected canvas upload format before canonical AVIF sanitization.
- Existing tests that encode the old PNG-only or browser-side AVIF assumptions
  should be updated to reflect the new ingress contract.

## Risks And Trade-Offs

- Lower WebP quality reduces source fidelity, but this is acceptable because the
  product values predictable upload size over preserving near-lossless canvas
  detail.
- A strict product contract around WebP keeps documentation cleaner, but any
  browser-specific fallback behavior would need to remain an implementation
  detail rather than a documented product guarantee.
- The backend validation surface broadens from PNG-only or AVIF-only ingress to
  WebP ingestion for canvas flows, so tests must continue to prove decode and
  sanitization safety.

## Success Criteria

- The PRD consistently describes `front -> back` canvas uploads as WebP.
- The PRD consistently describes persisted and delivered media as AVIF.
- Avatar and artwork canvas flows share one documented ingress contract.
- The media budget rationale is preserved while removing contradictory format
  language.