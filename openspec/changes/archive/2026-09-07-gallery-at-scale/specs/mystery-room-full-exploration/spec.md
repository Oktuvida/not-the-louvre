## ADDED Requirements

### Requirement: Mystery Room SHALL cycle through all artworks during idle
The Mystery Room idle animation SHALL progressively load and cycle through
every artwork in the database, not just a bounded pool.

#### Scenario: Idle reaches beyond initial pool
- **WHEN** idle scrolling reaches ~80% through the currently loaded artworks
- **THEN** the room SHALL prefetch the next page of artworks and append them to the pool

#### Scenario: Idle loops after exhausting all pages
- **WHEN** all artwork pages have been loaded (`hasMore = false`)
- **THEN** idle scrolling SHALL loop back to the beginning of the pool

#### Scenario: Prefetch failure does not interrupt idle
- **WHEN** a prefetch request fails during idle scrolling
- **THEN** idle SHALL continue looping through existing artworks and retry on the next cycle

### Requirement: StreamingAccumulator SHALL be append-only with no eviction
The `StreamingAccumulator` SHALL store all loaded artworks without a capacity
limit and without evicting older items.

#### Scenario: Accumulator grows without bound
- **WHEN** multiple pages of artworks are loaded
- **THEN** all artworks SHALL remain in `allArtworks` (no eviction)

#### Scenario: Accumulator deduplicates by artwork ID
- **WHEN** a page contains an artwork already present in the accumulator
- **THEN** the duplicate SHALL be ignored and the existing entry retained

#### Scenario: Accumulator tracks progress
- **WHEN** idle has scrolled through 500 of 1000 loaded artworks
- **THEN** `progress` SHALL report approximately 0.5

#### Scenario: Accumulator reseeds from SSR data
- **WHEN** the room mounts with server-provided artworks and pageInfo
- **THEN** `reseed()` SHALL replace internal state and reset the cursor

### Requirement: Spin SHALL select a random artwork from the full database
When the user clicks "Spin!", the system SHALL fetch a truly random artwork
from the entire database (not just the local pool) and animate to it.

#### Scenario: Spin fetches from server
- **WHEN** user clicks the spin button
- **THEN** the client SHALL call `GET /api/artworks/random` to get a random artwork

#### Scenario: Spin animates to the selected artwork
- **WHEN** the server returns a random artwork
- **THEN** FilmReel SHALL inject the artwork into the pool (if not present) and run the spin animation landing on it

#### Scenario: Spin opens detail panel on land
- **WHEN** the spin animation completes and lands on the target artwork
- **THEN** the artwork detail panel SHALL open

#### Scenario: Spin handles server error gracefully
- **WHEN** the `GET /api/artworks/random` request fails
- **THEN** the spin button SHALL show an error toast and FilmReel SHALL remain in idle state

### Requirement: FilmReel SHALL support targeted spin animation
FilmReel SHALL expose a `spinToArtwork(artwork)` method that injects a target
artwork and animates to land on it.

#### Scenario: spinToArtwork injects unknown artwork
- **WHEN** `spinToArtwork` is called with an artwork not in the pool
- **THEN** the artwork SHALL be injected at a random position in the pool before animating

#### Scenario: spinToArtwork handles known artwork
- **WHEN** `spinToArtwork` is called with an artwork already in the pool
- **THEN** the animation SHALL proceed to the existing position without duplication

### Requirement: FilmReel SHALL report idle progress for prefetching
FilmReel SHALL fire an `onIdleProgress(percent)` callback as idle scrolls,
allowing the parent room to trigger prefetching at a configurable threshold.

#### Scenario: Progress callback fires during idle
- **WHEN** idle scrolling progresses through the pool
- **THEN** `onIdleProgress` SHALL fire with the current scroll position as a fraction (0-1) of the pool
