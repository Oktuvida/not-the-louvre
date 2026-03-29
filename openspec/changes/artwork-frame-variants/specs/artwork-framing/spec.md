## ADDED Requirements

### Requirement: Gallery artworks use stable deterministic frame variants
The system SHALL present non-podium gallery artworks with a framed treatment chosen deterministically from a curated standard variant pool. The same artwork identity MUST resolve to the same standard frame variant across renders and visits unless the variant pool definition itself changes.

#### Scenario: Standard artwork keeps the same frame across renders
- **WHEN** the same non-podium artwork is rendered multiple times in gallery presentation surfaces
- **THEN** the system applies the same standard frame variant each time

#### Scenario: Different artworks can resolve to different standard variants
- **WHEN** distinct non-podium artworks are rendered in the same gallery surface
- **THEN** the system may assign different standard frame variants from the standard pool while preserving deterministic selection per artwork

### Requirement: Podium top-three artworks use the premium frame tier
The system SHALL reserve a premium frame tier for the three podium-ranked artworks only. Artworks outside podium positions 1 through 3 MUST NOT receive the premium tier from this presentation rule.

#### Scenario: First-place artwork receives premium framing
- **WHEN** an artwork is rendered in podium position 1, 2, or 3
- **THEN** the system assigns that artwork to the premium frame tier

#### Scenario: Non-podium artwork does not receive premium framing
- **WHEN** an artwork is rendered outside podium positions 1 through 3
- **THEN** the system assigns that artwork to the standard frame tier

### Requirement: Premium status remains explicitly visible in the frame contract
The system SHALL expose premium versus standard framing through an explicit presentation-level frame descriptor so future premium visual redesign can evolve without changing podium selection rules.

#### Scenario: Presentation consumer reads explicit frame tier
- **WHEN** a gallery presentation surface requests frame information for an artwork
- **THEN** the returned frame descriptor includes an explicit tier value identifying whether the frame is `standard` or `premium`
