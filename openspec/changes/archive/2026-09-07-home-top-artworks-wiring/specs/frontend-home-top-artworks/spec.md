## ADDED Requirements

### Requirement: Homepage top-artwork teaser uses persisted ranked discovery data
The system SHALL render the homepage entry-scene artwork teaser from real ranked discovery data rather than static mock preview cards.

#### Scenario: Homepage shows up to three ranked persisted artworks
- **WHEN** the homepage loads and ranked discovery returns visible artworks
- **THEN** the system renders up to three real artworks in the homepage teaser using that persisted discovery subset

#### Scenario: Homepage shows an honest empty teaser state
- **WHEN** the homepage loads and ranked discovery returns no visible artworks
- **THEN** the system does not render mock preview cards and instead resolves an empty teaser state
