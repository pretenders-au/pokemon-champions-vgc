## ADDED Requirements

### Requirement: Team-Specific SP Limit
The system SHALL enforce a maximum SP limit of 66 when editing a Pokémon within a team, but allow unrestricted SP in the Damage Calculator.

#### Scenario: Verify SP limit in team editor
- **WHEN** a user edits a Pokémon in a team
- **THEN** the total SP MUST be capped or visually flagged if it exceeds 66.

#### Scenario: Verify SP limit in Damage Calculator
- **WHEN** a user creates a set in the Damage Calculator
- **THEN** the total SP MUST not be capped at 66.
