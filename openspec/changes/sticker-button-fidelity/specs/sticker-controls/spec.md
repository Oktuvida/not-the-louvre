## ADDED Requirements

### Requirement: Shared sticker controls match the museum sticker reference language
The system SHALL provide shared button and link controls that use the museum sticker visual language, including the existing sticker canvas background, reference-aligned typography, reference-aligned hover and active motion, and consistent content placement for text-only and icon-plus-text actions.

#### Scenario: Shared button renders sticker treatment for icon and text content
- **WHEN** a product-facing action uses the shared sticker button primitive with both icon and label content
- **THEN** the control renders the museum sticker background and aligns the content using the shared sticker typography and spacing rules

#### Scenario: Shared link renders the same sticker treatment as a button
- **WHEN** a product-facing navigation action uses the shared sticker link primitive
- **THEN** the control matches the shared sticker button's variant, sizing, and interaction language except for its link semantics

### Requirement: Shared sticker controls support production size and variant presets
The system SHALL support sticker control presets that cover compact, standard, and large CTA usage, plus the product variants `primary`, `secondary`, `accent`, `danger`, and `ghost`.

#### Scenario: Large CTA uses the large sticker preset
- **WHEN** a product surface renders a prominent call-to-action through the shared sticker controls
- **THEN** the control can use a large preset that preserves the museum sticker proportions and readable content sizing

#### Scenario: Ghost action uses the ghost sticker variant
- **WHEN** a product surface renders a secondary back or cancel action through the shared sticker controls
- **THEN** the control can use the ghost sticker variant while preserving the shared sticker material treatment

### Requirement: Disabled sticker controls remain visually consistent
The system SHALL render disabled shared sticker controls using the museum sticker disabled treatment without changing layout or semantics.

#### Scenario: Disabled publish action uses sticker disabled treatment
- **WHEN** a shared sticker control is disabled
- **THEN** the control preserves its sticker shape and content layout while applying the shared disabled opacity and interaction suppression rules
