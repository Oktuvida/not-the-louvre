## ADDED Requirements

### Requirement: Brass plaque displays gallery title with metallic finish
The system SHALL render a brass plaque component with metallic gradient background, engraved-style text, and decorative screw heads at the corners, replacing the plain text gallery title.

#### Scenario: Plaque renders gallery title
- **WHEN** the gallery page renders
- **THEN** the gallery title is displayed inside a brass plaque with metallic gradient, engraved text styling, and visible corner screws

### Requirement: Brass plaque supports configurable text
The system SHALL accept text content as a prop, allowing the plaque to display any title or label.

#### Scenario: Custom text on plaque
- **WHEN** a brass plaque is rendered with custom text
- **THEN** the plaque displays that text with engraved styling

### Requirement: Brass plaque supports three size variants
The system SHALL support small, medium, and large size variants for different display contexts.

#### Scenario: Large plaque for page title
- **WHEN** a brass plaque renders in large size
- **THEN** the plaque is sized appropriately for a page-level heading

#### Scenario: Small plaque for labels
- **WHEN** a brass plaque renders in small size
- **THEN** the plaque is compact, suitable for section labels or captions
