## ADDED Requirements

### Requirement: All gallery rooms support cursor-based continuation
The system SHALL expose cursor-based continuation metadata for every gallery room, enabling the frontend to request additional pages of artworks beyond the initial server-rendered page.

#### Scenario: Non-studio room receives continuation metadata
- **WHEN** a user loads any gallery room (hall-of-fame, hot-wall, mystery, or your-studio)
- **THEN** the server response includes discovery request metadata with sort, limit, and cursor information

#### Scenario: Frontend requests next page for a non-studio room
- **WHEN** the frontend requests the next page of artworks for a non-studio room using the cursor from the previous response
- **THEN** the system returns the next page of artworks with updated cursor metadata

#### Scenario: Last page indicates no more results
- **WHEN** the frontend requests a page and no further artworks exist
- **THEN** the response indicates there is no next page and the frontend stops requesting

### Requirement: Mystery room uses bounded candidate pool retention
The system SHALL maintain a bounded pool of artwork candidates for the mystery room, evicting old pages as new pages arrive to prevent unbounded memory growth.

#### Scenario: Mystery room fetches additional artworks when pool runs low
- **WHEN** the mystery reel's unseen candidate count drops below the low-water mark
- **THEN** the system requests the next page of artworks via cursor continuation

#### Scenario: Bounded pool evicts oldest page on new page arrival
- **WHEN** a new page of artworks arrives for the mystery room and the pool is at capacity
- **THEN** the oldest page of artworks is evicted from the candidate pool

#### Scenario: Mystery room operates within bounded memory
- **WHEN** the mystery reel has been auto-advancing through artworks for an extended period
- **THEN** the total number of artworks held in memory does not exceed the pool capacity

### Requirement: Scrollable rooms use append retention with virtualization
The system SHALL append fetched pages for scrollable rooms (hall-of-fame, hot-wall, your-studio) and rely on DOM virtualization to keep rendering efficient.

#### Scenario: Scrollable room appends new page to existing artworks
- **WHEN** additional artworks are fetched for a scrollable room
- **THEN** the new artworks are appended to the existing list and become available for rendering

#### Scenario: Scrollable room continues loading across multiple pages
- **WHEN** a user triggers continuation multiple times in a scrollable room
- **THEN** each page is appended in order and the full accumulated list is available for virtualized rendering
