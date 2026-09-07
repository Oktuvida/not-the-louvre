## ADDED Requirements

### Requirement: Table background image with format fallback
The draw page SHALL display a full-bleed background image of the studio table using `table.avif` as the primary format and `table.webp` as the fallback. The image SHALL cover the entire viewport using `object-fit: cover` and be positioned behind all page content.

#### Scenario: Browser supports avif
- **WHEN** the draw page loads in a browser that supports avif
- **THEN** the browser SHALL load `table.avif` as the background image

#### Scenario: Browser does not support avif
- **WHEN** the draw page loads in a browser that does not support avif
- **THEN** the browser SHALL fall back to `table.webp` as the background image

#### Scenario: Background covers viewport
- **WHEN** the draw page is displayed at any viewport size
- **THEN** the background image SHALL fill the entire viewport without repeating, using cover behavior to maintain aspect ratio

### Requirement: Gradient overlays removed
The draw page SHALL NOT render the existing radial-gradient and linear-gradient overlay layers that were designed for the flat color background.

#### Scenario: No gradient overlays visible
- **WHEN** the draw page loads
- **THEN** the previous gradient overlay `div` elements SHALL be absent from the DOM

### Requirement: Tunable book stage positioning
The draw page SHALL expose book stage positioning values (horizontal offset, vertical offset, and scale) as clearly named CSS custom properties on the page root container. These properties SHALL control the book stage's `transform` so that its position can be adjusted to align with the table surface in the background image.

#### Scenario: Custom properties control book position
- **WHEN** a developer changes the value of `--book-offset-x`, `--book-offset-y`, or `--book-scale` in the page styles
- **THEN** the book stage position and scale SHALL update accordingly without requiring changes to any other code

#### Scenario: Default values produce reasonable alignment
- **WHEN** the draw page loads with the default custom property values
- **THEN** the book stage SHALL be positioned approximately over the table surface area in the background image
