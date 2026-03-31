## ADDED Requirements

### Requirement: Canvas frame renderer supports gold, silver, and bronze color schemes
The system SHALL extend the existing `drawArtworkFrame` function to accept a `colorScheme` option with values `'gold'`, `'silver'`, or `'bronze'`, each producing a distinct metallic palette for the frame moulding.

#### Scenario: Gold color scheme renders warm gold tones
- **WHEN** `drawArtworkFrame` is called with `colorScheme: 'gold'`
- **THEN** the frame renders with gold palette — gA:`[212,168,64]`, gB:`[192,146,42]`, gC:`[142,104,32]`, gD:`[98,72,22]`

#### Scenario: Silver color scheme renders cool grey tones
- **WHEN** `drawArtworkFrame` is called with `colorScheme: 'silver'`
- **THEN** the frame renders with silver palette — gA:`[216,216,216]`, gB:`[192,192,192]`, gC:`[144,144,144]`, gD:`[96,96,96]`

#### Scenario: Bronze color scheme renders warm brown tones
- **WHEN** `drawArtworkFrame` is called with `colorScheme: 'bronze'`
- **THEN** the frame renders with bronze palette — gA:`[212,160,106]`, gB:`[205,127,50]`, gC:`[160,98,46]`, gD:`[122,74,26]`

#### Scenario: Default color scheme is gold
- **WHEN** `drawArtworkFrame` is called without a `colorScheme` option
- **THEN** the frame renders with the gold palette (backward compatible)

### Requirement: Frame color scheme is part of ArtworkFrameRenderOptions
The system SHALL add an optional `colorScheme` property to `ArtworkFrameRenderOptions` with type `'gold' | 'silver' | 'bronze'`.

#### Scenario: Render options accept colorScheme
- **WHEN** an `ArtworkFrameRenderOptions` object is constructed with `colorScheme: 'silver'`
- **THEN** the type system accepts it without error

### Requirement: Frame resolution assigns color scheme by podium position
The system SHALL assign `colorScheme: 'gold'` to podium position 1, `colorScheme: 'silver'` to position 2, and `colorScheme: 'bronze'` to position 3 when resolving frame options via `resolveArtworkFrame`.

#### Scenario: First place gets gold frame
- **WHEN** `resolveArtworkFrame` resolves options for podium position 1
- **THEN** the returned options include `colorScheme: 'gold'`

#### Scenario: Second place gets silver frame
- **WHEN** `resolveArtworkFrame` resolves options for podium position 2
- **THEN** the returned options include `colorScheme: 'silver'`

#### Scenario: Third place gets bronze frame
- **WHEN** `resolveArtworkFrame` resolves options for podium position 3
- **THEN** the returned options include `colorScheme: 'bronze'`
