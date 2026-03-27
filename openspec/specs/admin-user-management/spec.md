## ADDED Requirements

### Requirement: Admin user listing with pagination
The system SHALL allow authenticated admins to list all users with cursor-based pagination, returning each user's ID, nickname, avatar URL, role, and creation date.

#### Scenario: Admin lists users
- **WHEN** an authenticated admin requests the user list
- **THEN** the system returns a paginated list of users ordered by creation date descending

#### Scenario: Admin lists users with cursor continuation
- **WHEN** an authenticated admin requests the next page of users using a continuation cursor
- **THEN** the system returns the next batch of users continuing from where the previous page ended

#### Scenario: Non-admin cannot list users
- **WHEN** an authenticated user without admin privileges requests the user list
- **THEN** the system rejects the request

#### Scenario: Unauthenticated user cannot list users
- **WHEN** an unauthenticated request is made to the user list endpoint
- **THEN** the system rejects the request

### Requirement: Admin role assignment
The system SHALL allow authenticated admins to change a user's role to `moderator` or back to `user`. Admins SHALL NOT be able to change another admin's role or their own role.

#### Scenario: Admin promotes user to moderator
- **WHEN** an authenticated admin changes a user's role from `user` to `moderator`
- **THEN** the system updates the user's role and returns the updated profile

#### Scenario: Admin demotes moderator to user
- **WHEN** an authenticated admin changes a moderator's role back to `user`
- **THEN** the system updates the user's role and returns the updated profile

#### Scenario: Admin cannot change another admin's role
- **WHEN** an authenticated admin attempts to change the role of another admin
- **THEN** the system rejects the request

#### Scenario: Admin cannot change their own role
- **WHEN** an authenticated admin attempts to change their own role
- **THEN** the system rejects the request

#### Scenario: Non-admin cannot change roles
- **WHEN** an authenticated user without admin privileges attempts to change any user's role
- **THEN** the system rejects the request

#### Scenario: Role change for nonexistent user
- **WHEN** an admin attempts to change the role of a user ID that does not exist
- **THEN** the system returns a not-found response
