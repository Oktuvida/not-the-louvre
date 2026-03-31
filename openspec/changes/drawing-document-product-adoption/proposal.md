## Why

The product still treats raster media as the primary editable artifact for both
artwork and avatar flows. That creates cumulative quality loss when users fork
artworks or re-edit avatars, and it keeps the browser image export format at the
center of flows that should instead be driven by a stable, product-owned source
of truth.

The repo now has an approved drawing-document design and a validated demo that
shows a JSON stroke document preserves fidelity better than repeated bitmap
reloads. The product needs to adopt that model directly.

## What Changes

- Introduce drawing-document persistence for artwork and avatar records.
- Derive canonical AVIF media in the backend from the stored drawing document.
- Update artwork publish/fork and avatar save/edit flows to submit drawing
  documents instead of browser-exported source images.
- Add local draft recovery in the client for avatar and artwork flows.

## Capabilities

### New Capabilities
- `drawing-document-lifecycle`: Shared product capability for validating,
  compressing, persisting, replaying, and deriving media from versioned drawing
  documents.

### Modified Capabilities
- `artwork-publishing`: publish and fork use drawing documents as the editable
  source of truth.
- `avatar-management`: avatar save and re-edit use drawing documents as the
  editable source of truth.

## Impact

- Affected code: shared drawing modules, draw route, home/avatar flows, artwork
  and avatar services, database schema, storage contracts, and product tests.
- Affected systems: artwork creation, forking, avatar onboarding, avatar edit,
  backend media derivation, and draft recovery.