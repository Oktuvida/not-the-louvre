## ADDED Requirements

### Requirement: Discovery surfaces use shared sticker controls for primary actions
The system SHALL present gallery and hall-of-fame primary navigation and high-level artwork actions using the shared sticker control primitives where those actions are intended as product-facing CTAs.

#### Scenario: Gallery room navigation uses shared sticker controls
- **WHEN** a user views a gallery discovery surface with room navigation or primary route actions
- **THEN** those actions use the shared sticker control language instead of custom one-off button or link markup

#### Scenario: Artwork action panel uses shared sticker controls
- **WHEN** a user views high-level artwork actions such as vote, comment, close, or fork in discovery-related artwork presentation
- **THEN** those actions use the shared sticker control primitives with the appropriate product variant
