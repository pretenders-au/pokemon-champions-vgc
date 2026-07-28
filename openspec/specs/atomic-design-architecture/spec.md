## ADDED Requirements

### Requirement: Atomic Component Categorization
The system SHALL organize all UI components into `Atoms`, `Molecules`, `Organisms`, and `Templates` based on their complexity and purpose.

#### Scenario: Categorizing a simple button
- **WHEN** a component is a basic HTML element with simple styling (like a button or label)
- **THEN** it SHALL be placed in `src/components/atoms/`.

#### Scenario: Categorizing a section layout
- **WHEN** a component combines multiple molecules and atoms into a distinct section (like a stat tier group)
- **THEN** it SHALL be placed in `src/components/organisms/`.

### Requirement: Pure Presentational Components
Atoms SHALL NOT contain business logic, side effects, or complex state; a component needing any of those SHALL be a Molecule or higher. Molecules MAY hold internal state and domain logic — that is what separates them from Atoms — but SHALL NOT fetch data or perform side effects.

#### Scenario: Passing data to a Molecule
- **WHEN** a Molecule needs data it does not own
- **THEN** it SHALL receive that data as props from its parent Organism or Page.
