## ADDED Requirements

### Requirement: Scroll sentinel triggers page loading
The system SHALL render a sentinel element below the last artwork in scrollable rooms (your-studio, hall-of-fame). When the sentinel enters the viewport, the system SHALL fetch the next page of artworks using the current cursor.

#### Scenario: User scrolls to bottom of your-studio grid
- **WHEN** the user scrolls until the scroll sentinel enters the viewport in your-studio
- **THEN** the system fetches the next page of artworks using the current cursor and appends them to the grid

#### Scenario: User scrolls to bottom of hall-of-fame grid
- **WHEN** the user scrolls until the scroll sentinel enters the viewport below the hall-of-fame ranked grid (below the podium section)
- **THEN** the system fetches the next page of top-ranked artworks and appends them below the existing ranked cards

#### Scenario: Sentinel does not trigger when no more pages exist
- **WHEN** the scroll sentinel enters the viewport and the server has indicated no more pages (`hasMore: false`)
- **THEN** the system SHALL NOT make a fetch request and SHALL display an end-of-list indicator

#### Scenario: Sentinel does not trigger during an active fetch
- **WHEN** the scroll sentinel enters the viewport while a page fetch is already in progress
- **THEN** the system SHALL NOT make a concurrent fetch request

### Requirement: Skeleton loading cards during page fetches
The system SHALL display skeleton placeholder cards (pulsing gray rectangles matching the artwork card shape) below the last real artwork while a page fetch is in progress, maintaining the grid layout shape.

#### Scenario: Skeleton cards appear during fetch
- **WHEN** a page fetch is triggered by the scroll sentinel or by a mystery room spin
- **THEN** a row of skeleton cards matching the current column count is rendered below the last real artwork

#### Scenario: Skeleton cards are replaced by real content on success
- **WHEN** a page fetch completes successfully
- **THEN** the skeleton cards are removed and replaced by the real artwork cards without layout shift

### Requirement: Fetch errors are surfaced with retry
The system SHALL display an error message with a retry action when a page fetch fails, instead of silently swallowing the error.

#### Scenario: Network error during page fetch
- **WHEN** a page fetch fails due to a network or server error
- **THEN** the system displays an error message with a retry button below the last artwork

#### Scenario: User retries a failed fetch
- **WHEN** the user activates the retry action after a failed fetch
- **THEN** the system re-attempts the same page fetch using the same cursor

### Requirement: Fetched artworks are deduplicated
The system SHALL deduplicate artworks across pages so that the same artwork never appears twice in the rendered list, even if the underlying data changes between page fetches.

#### Scenario: Duplicate artwork in consecutive pages
- **WHEN** the next page contains an artwork already present in the current list
- **THEN** the duplicate is excluded and only new artworks are appended

### Requirement: True DOM virtualization for grid rooms
The system SHALL use true DOM virtualization (via `virtua`) for artwork grids so that only the rows near the viewport exist in the DOM. Off-screen rows SHALL be removed from the DOM entirely, not merely hidden.

#### Scenario: Only visible rows are in the DOM
- **WHEN** 200+ artworks are loaded in the your-studio grid
- **THEN** only rows near the viewport (visible + small overscan buffer) exist as DOM nodes; scrolling creates and destroys row elements dynamically

#### Scenario: Responsive column count
- **WHEN** the viewport width changes (mobile 1-column, tablet 2-column, desktop 3-column)
- **THEN** artworks are re-grouped into rows matching the new column count and the virtualizer adapts without content jumps or scroll position loss

#### Scenario: Dynamic row height measurement
- **WHEN** a row contains cards with varying metadata height (e.g., fork badge present on some cards)
- **THEN** the virtualizer measures actual row height via ResizeObserver and uses the measured height for scroll calculations

### Requirement: Mystery room traverses full catalog via bounded pool
The system SHALL allow the mystery room's film reel to traverse the entire artwork catalog by fetching successive pages on demand, while keeping the in-memory artwork pool bounded to a fixed capacity.

#### Scenario: Low-water-mark triggers next page fetch
- **WHEN** the user spins the mystery reel and the number of unseen artworks in the pool drops below the low-water mark (12)
- **THEN** the system fetches the next page and adds new artworks to the pool

#### Scenario: Pool eviction keeps memory bounded
- **WHEN** a new page of artworks is added to the mystery pool and the total exceeds the pool capacity (36)
- **THEN** the oldest page of artworks is evicted from the pool so the total does not exceed the capacity

#### Scenario: Pool eviction occurs only when reel is stopped
- **WHEN** the reel is in idle scrolling state and a page fetch completes
- **THEN** eviction is deferred until the reel stops (between spins), preventing visual jumps during animation

#### Scenario: Full catalog traversal
- **WHEN** the user continues spinning until the cursor reaches the end of the catalog (`hasMore: false`)
- **THEN** the system stops requesting more pages and the reel continues cycling through the remaining pool

### Requirement: Hall-of-fame podium is always rendered
The system SHALL always render the top-3 podium section (medals, frames, plaques) without virtualization or lazy loading, regardless of scroll position.

#### Scenario: Podium is visible on initial load
- **WHEN** the user navigates to the hall-of-fame room
- **THEN** the top-3 podium artworks are immediately visible with medals, frames, and plaques

#### Scenario: Podium is not affected by infinite scroll
- **WHEN** the user scrolls through additional ranked artworks below the podium
- **THEN** the podium section remains rendered and accessible when scrolling back up

### Requirement: Window-level scrolling
The system SHALL use window-level scrolling (not a fixed-height inner scroll container) for all gallery room grids. The page SHALL scroll normally via the browser's native scroll, and the virtualizer SHALL track the window scroll position.

#### Scenario: No nested scrolling
- **WHEN** the user scrolls the gallery page on any device
- **THEN** there is a single scroll context (the window), not a scroll-within-a-scroll
