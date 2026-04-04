# Stroke JSON Product Default Raster Guard

**Date:** 2026-04-03
**Status:** Proposed

## Context

The stroke-json work now has two separate concerns that happen to share the same
safe raster-guard preset vocabulary:

- the demo and lab surfaces, where a preset can be selected explicitly for
  experimentation
- the real persistence path, where a drawing document is serialized and
  compressed for avatar and artwork storage

Today these two concerns are not aligned.

The lab imports `DEFAULT_SAFE_RASTER_GUARD_PRESET_ID` from
`compaction.ts`, but the real persistence path in `storage.ts` does not use the
lossless compactor at all. It currently normalizes and serializes the incoming
document, then gzip-compresses that result directly.

That means changing only the UI-facing preset default would change the demo
experience, but it would not make `veryConservative` the effective product
default for stored drawing documents.

The user explicitly wants `veryConservative` to become the default in product
behavior, not just in the lab.

## Decision

Make `veryConservative` the default raster-guard policy for the real
compression pipeline used by persisted drawing documents.

This default must be applied in the shared stroke-json storage path rather than
only in the lab.

The implementation should:

- keep the demo preset selector and the product default conceptually separate
- run lossless compaction before gzip/base64 encoding in the real storage path
- use the `veryConservative` raster-guard preset when no explicit compaction
  configuration is provided
- preserve a way to override the default explicitly for research or future
  callers

## Goals

- Make `veryConservative` the actual default behavior for persisted drawing
  documents.
- Ensure avatar and artwork compression share the same default behavior through
  one central code path.
- Avoid duplicating raster-guard policy in server call sites.
- Preserve explicit overrides for callers that need different compaction
  behavior.
- Keep the lab free to choose its own initial preset independently from product
  persistence defaults.

## Non-Goals

- Redesigning the raster oracle presets themselves.
- Removing the `canonical` or `conservative` presets.
- Forcing the lab UI to use the same initial preset as production.
- Wiring the prod-like demo pipeline directly into production persistence.
- Changing the serialized V2 document structure beyond what the compactor
  already emits.

## Product Default Semantics

The product default is defined as:

- when a caller asks to compress a drawing document for storage
- and the caller does not supply an explicit raster-guard or compaction option
- the system must compact the document losslessly using the
  `veryConservative` preset
- then serialize and gzip the compacted result

This default applies to the shared storage helper, not to only one server
feature.

As a result, existing call sites such as avatar save and artwork publish inherit
the same behavior automatically once they continue using the shared compression
helper.

## Separation of Defaults

The codebase should distinguish two different defaults:

1. **Lab default**
   This controls the initially selected preset in the demo UI.

2. **Product compression default**
   This controls what the real persistence pipeline does when no explicit option
   is passed.

These defaults may be the same value today, but they should not be represented
as the same concept. Tying them together would make future demo-oriented changes
silently affect production persistence, or vice versa.

The design therefore prefers an explicit product-side default constant rather
than reusing a UI-oriented default name for two different responsibilities.

## Architecture

### Shared Compression Flow

`storage.ts` becomes the canonical boundary for product compression behavior.

The shared flow should be:

1. validate and normalize the incoming drawing document
2. resolve the effective compaction options
3. run lossless compaction with those options
4. serialize the compacted V2 document
5. gzip the serialized output
6. enforce byte limits on the compressed result

This keeps policy centralized and ensures all callers using the storage helper
benefit from the same default.

### Effective Default Resolution

The shared storage helper should expose optional compaction configuration, but it
must not require every caller to choose a preset manually.

If no explicit config is provided, the helper resolves to the product default:

- preset: `veryConservative`
- dimensions: taken from the normalized document itself
- resolved max stroke coverage pixels: derived from the preset ratio and the
  document dimensions

If explicit compaction settings are provided, those settings override the
default.

### Compactor Boundary

The lossless compactor remains the owner of raster-guard behavior and exact
occlusion logic. The storage helper should resolve a product-default preset into
concrete compaction options and then call the compactor.

This avoids duplicating the compaction algorithm inside storage code while still
keeping production-default policy close to the persistence boundary.

## API Direction

The shared storage API should remain easy to use for current callers.

Preferred direction:

- keep the current limits argument intact
- extend the compression helper with optional product-compaction options only if
  necessary
- default to product behavior when those options are absent

The API should not force call sites like avatar publish or artwork publish to
become aware of raster-guard presets unless they have a real product need to
override them.

## Lab Behavior

The lab may continue to import and display a UI-facing default preset, but that
choice is orthogonal to production compression.

If the implementation also chooses to update the lab’s initial selection to
`veryConservative`, that should be treated as a separate UX choice, not as the
mechanism that makes production use `veryConservative`.

## Testing Strategy

## Unit Coverage

Add or update focused tests around the shared storage helper to prove product
defaults now pass through lossless compaction.

The tests should verify:

- compression without explicit options uses `veryConservative`
- explicit compaction options still override the product default
- compressed output remains valid and decodable
- V1 input still normalizes correctly through the shared path

## Integration Confidence

Existing tests that exercise avatar and artwork persistence through shared
compression should continue to pass without requiring server call sites to be
rewired individually.

The purpose of this change is precisely to avoid scattered call-site policy.

## Risks and Mitigations

### Risk: Demo Default and Product Default Drift Confusion

If both defaults happen to share the same preset but are represented by one
symbol, future changes can accidentally alter the wrong behavior.

Mitigation:

- represent product default policy explicitly at the storage boundary
- keep demo default naming independent

### Risk: Unexpected Storage Output Changes

Making real compression compact losslessly before gzip changes the stored JSON
payload that downstream systems may observe.

Mitigation:

- keep the compaction step lossless relative to canonical render semantics
- preserve decode compatibility through the existing document parser and
  normalizer
- validate through focused storage tests and the full repository test suite

### Risk: Overriding Becomes Awkward

If the storage API is changed too aggressively, callers may become harder to
use or reason about.

Mitigation:

- keep overrides optional
- preserve the current simple default call path
- only add configuration surface where it meaningfully affects behavior

## Implementation Notes for Planning

The implementation plan should focus on:

- introducing an explicit product-default raster-guard resolution path
- wiring shared storage compression through lossless compaction
- updating any affected tests around storage and product persistence
- deciding whether the lab’s initial preset should also change, but treating
  that as separate from the production-default requirement