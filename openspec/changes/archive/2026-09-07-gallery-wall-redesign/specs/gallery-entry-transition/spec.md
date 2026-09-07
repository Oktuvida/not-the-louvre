## ADDED Requirements

### Requirement: GALLERY button triggers animated transition to Your Studio
The system SHALL play a camera animation and fade overlay when the user clicks the GALLERY button on the home page, then navigate to `/gallery/your-studio`.

#### Scenario: User clicks GALLERY on home page
- **WHEN** the user clicks the GALLERY button on the home page
- **THEN** a GSAP camera animation begins zooming toward the wall
- **AND** a full-screen fade overlay gradually covers the viewport in the wall's gray color
- **AND** when the overlay fully covers the screen, the system navigates to `/gallery/your-studio`

#### Scenario: Gallery page fade-in after transition
- **WHEN** the gallery page mounts after the home-to-gallery navigation
- **THEN** the page content SHALL fade in from the wall's gray color over 300-500ms

### Requirement: Transition does not block direct gallery access
The system SHALL allow direct URL navigation to `/gallery/your-studio` without requiring the home page transition.

#### Scenario: Direct URL access to Your Studio
- **WHEN** a user navigates directly to `/gallery/your-studio` via URL or bookmark
- **THEN** the gallery page loads normally without the fade-in animation

#### Scenario: Navigation from another gallery room to Your Studio
- **WHEN** a user is in another gallery room and clicks the Your Studio tab
- **THEN** a lateral slide transition occurs (not the fade-through from home)
