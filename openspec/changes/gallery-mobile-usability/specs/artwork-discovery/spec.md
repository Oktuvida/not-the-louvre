## ADDED Requirements

### Requirement: Gallery discovery remains usable on narrow mobile viewports
The system SHALL keep core gallery discovery surfaces usable on narrow mobile viewports without requiring a separate mobile-only gallery flow.

#### Scenario: Homepage mobile chrome prioritizes primary navigation
- **WHEN** the homepage persistent navigation is rendered on a narrow mobile viewport
- **THEN** non-essential decorative preview content does not compete with the primary gallery navigation and account controls

#### Scenario: Gallery shell fits narrow mobile viewports
- **WHEN** a visitor opens any gallery room on a narrow mobile viewport
- **THEN** the gallery shell keeps room navigation and primary controls available without forcing desktop-only spacing assumptions

### Requirement: Mystery room preserves horizontal discovery on narrow mobile viewports
The system SHALL preserve the Mystery room's horizontal reel interaction on narrow mobile viewports while adapting its presentation to remain readable and operable.

#### Scenario: Mystery reel remains horizontal on mobile
- **WHEN** a visitor opens the Mystery room on a narrow mobile viewport
- **THEN** the room still presents a horizontally oriented reel rather than switching to a different navigation model

#### Scenario: Mystery controls remain operable on mobile
- **WHEN** a visitor uses the Mystery room on a narrow mobile viewport
- **THEN** the reel viewport, spin control, and supporting room chrome fit the viewport closely enough for the feature to remain usable without horizontal page overflow
