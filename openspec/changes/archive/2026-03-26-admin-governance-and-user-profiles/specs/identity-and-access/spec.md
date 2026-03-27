## MODIFIED Requirements

### Requirement: Role and RBAC foundations
The system SHALL persist a role for every product user and make that role available through the canonical authenticated product identity. The role field SHALL support admin-initiated mutations beyond default assignment at signup, enabling governance workflows such as moderator promotion and demotion.

#### Scenario: New account receives default role
- **WHEN** a visitor successfully creates a new account
- **THEN** the system assigns the default product role `user`

#### Scenario: Authenticated request carries role information
- **WHEN** server-side code resolves an authenticated product identity
- **THEN** the resolved identity includes the user's current persisted role for downstream authorization checks

#### Scenario: Role mutation by admin persists and takes effect on next request
- **WHEN** an admin changes a user's role and the affected user makes a subsequent authenticated request
- **THEN** the resolved canonical identity reflects the updated role
