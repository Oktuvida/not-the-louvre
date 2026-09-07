## ADDED Requirements

### Requirement: Home entry stays usable while studio scene media loads
The system SHALL render the home entry route without blocking the page on the transformed Studio GLB.

#### Scenario: Visitor lands on home before the GLB resolves
- **WHEN** the home route renders and the transformed Studio GLB is still pending
- **THEN** the system renders the home entry page and leaves primary controls usable while showing only a localized scene placeholder

#### Scenario: Studio GLB load fails
- **WHEN** the transformed Studio GLB fails to load
- **THEN** the system keeps the home entry page usable and retains the localized fallback state instead of showing a blocking loading screen

### Requirement: Loaded studio scene replaces the fallback without re-blocking the page
The system SHALL reveal the transformed Studio GLB with a localized transition that does not re-block the page once the model resolves.

#### Scenario: GLB resolves after the page is already visible
- **WHEN** the transformed Studio GLB finishes loading after the home entry route has already rendered
- **THEN** the system replaces the localized placeholder with the live scene without disrupting page controls or returning to a loading-only state