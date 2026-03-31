## ADDED Requirements

### Requirement: Visitor badge displays user identity with museum aesthetic
The system SHALL render a "HELLO MY NAME IS" visitor badge component that displays the user's avatar and nickname in a sticker-style badge with a colored header stripe.

#### Scenario: Badge renders with user data
- **WHEN** a signed-in user views the homepage
- **THEN** the visitor badge displays their avatar image in a circle and their nickname in a handwriting font (Caveat) below the "HELLO MY NAME IS" header

#### Scenario: Badge renders without avatar
- **WHEN** a signed-in user has no custom avatar
- **THEN** the visitor badge displays a default placeholder circle with the user's initial letter

### Requirement: Visitor badge color is deterministic per user
The system SHALL select one of five badge color variants (red `#c84f4f`, blue `#4a7fb5`, green `#5a9a5a`, orange `#d4874d`, purple `#8b6aae`) based on a hash of the user's ID, producing the same color for the same user on every render.

#### Scenario: Same user always gets same color
- **WHEN** the visitor badge renders for a given user ID
- **THEN** the badge header stripe color is always the same deterministic color for that user ID

#### Scenario: Different users get varied colors
- **WHEN** visitor badges render for multiple different users
- **THEN** the badge colors are distributed across the five variants based on each user's ID hash

### Requirement: Visitor badge replaces the signed-in card on the homepage
The system SHALL replace the existing "Signed in as" card in `PersistentNav` with the visitor badge component.

#### Scenario: Homepage shows visitor badge instead of plain card
- **WHEN** a signed-in user views the homepage
- **THEN** the visitor badge is displayed in place of the former "Signed in as" bordered card
