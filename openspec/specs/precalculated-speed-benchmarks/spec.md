## ADDED Requirements

### Requirement: Pre-calculate speed benchmarks for every legal Pokémon
The system SHALL pre-calculate and store four speed benchmarks (`maxPlus`, `maxNeutral`, `uninvested`, `minMinus`) for each Pokémon legal in any Regulation.

#### Scenario: Pre-calculation for a legal Pokémon
- **WHEN** a Pokémon is legal in at least one Regulation
- **THEN** the system SHALL compute its four benchmarks based on its `baseSpeed` and store them in the `calculated_speeds` table.

### Requirement: Idempotent speed benchmark updates
The system SHALL allow updating existing pre-calculated speed benchmarks without duplicate records.

#### Scenario: Updating existing pre-calculated speed stats
- **WHEN** a Pokémon already has a record in the `calculated_speeds` table
- **THEN** the system SHALL overwrite the existing benchmarks with the newly computed values.
