## ADDED Requirements

### Requirement: Direct database access for speed data
The system SHALL provide a mechanism to fetch Pokémon speed data directly from the `calculated_speeds` table using Drizzle ORM.

#### Scenario: Successful data retrieval
- **WHEN** the component initiates a query for the selected Regulation's speed tiers
- **THEN** the system SHALL return a flat list of Pokémon containing `id`, `name`, `baseSpeed`, `maxPlus`, `maxNeutral`, `uninvested`, and `minMinus`.

### Requirement: Filter by the selected Regulation
The data fetching logic MUST strictly filter Pokémon based on their legality in the selected Regulation (a `formats` row; the latest, "Regulation M-C", by default).

#### Scenario: Format filtering
- **WHEN** querying for speed tiers
- **THEN** only Pokémon linked to that format via `format_pokemon` SHALL be included in the results.
