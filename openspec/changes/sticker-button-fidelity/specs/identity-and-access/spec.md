## ADDED Requirements

### Requirement: Auth and session CTAs use the shared sticker control language
The system SHALL present product-facing auth and session actions using the shared museum sticker control primitives where those actions are primary user calls to action.

#### Scenario: Sign-in and sign-up submissions use shared sticker buttons
- **WHEN** a visitor encounters primary auth submission actions in the product experience
- **THEN** those actions use the shared sticker button primitive rather than custom one-off button markup

#### Scenario: Session navigation uses shared sticker link or button controls
- **WHEN** an authenticated or unauthenticated user encounters high-level session navigation actions such as entering the gallery, creating art, or signing out
- **THEN** those actions use the shared sticker control language consistently across the product surfaces that expose them
