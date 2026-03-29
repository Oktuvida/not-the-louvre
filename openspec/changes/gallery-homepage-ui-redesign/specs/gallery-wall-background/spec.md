## ADDED Requirements

### Requirement: Gallery page uses museum wall background image
The system SHALL display `gallery-bg.webp` as the background image for the gallery page, replacing the flat `bg-[#f5f0e8]` background color.

#### Scenario: Gallery background shows wall texture
- **WHEN** the gallery page renders
- **THEN** the background displays the `gallery-bg.webp` museum wall texture with `background-size: cover` and `background-attachment: fixed`

#### Scenario: Background remains fixed during scroll
- **WHEN** the user scrolls the gallery page
- **THEN** the background remains stationary while content scrolls over it, creating the effect of objects mounted on a wall

### Requirement: Gallery top bar is transparent
The system SHALL remove the solid white background and `border-b-4` from the gallery top bar, making it transparent so the museum wall texture shows through.

#### Scenario: Top bar has no solid background
- **WHEN** the gallery page renders
- **THEN** the top bar area has no white background or bottom border, and the wall texture is visible behind the title and navigation elements
