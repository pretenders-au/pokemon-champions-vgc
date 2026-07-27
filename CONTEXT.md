# Domain Context

The shared vocabulary for this project. Capability-level specs live in `openspec/specs/`;
this file names the concepts those specs talk about, so code and conversation use the same words.

## Build

### Set resolution

Matching a **Parsed Showdown set** against the dex to produce a **Pokémon config**.

A pasted or scanned Showdown set carries free text — `"Indeedee-F"`, `"專愛圍巾"`, a
misspelled move. Set resolution is the step that turns that text into real dex rows:
species, ability, item and up to four moves, plus the **Nature** pair.

It reports two things alongside the result:

- **Corrections** — a lookup succeeded, but not exactly. `"Landorus" ➔ "Landorus (Therian)"`.
  Surfaced to the user as a toast so they can see what the app assumed.
- **Errors** — a lookup failed. An unrecognised **species** is fatal for that set (no config
  can be built). An unrecognised ability, item or move is not: the config is still built with
  that field left empty, and the failure is reported.

Set resolution never decides how to present either list, and never aborts a batch. Whether a
failure aborts an import is the caller's policy — single-set callers abort, team imports keep
the members that did resolve.

Lives in `src/features/pokemon/utils/showdown-import.ts`.

### Pokémon config

One configured Pokémon: species and base stats, **SP** spread, **Nature**, ability, item, up
to four moves. The unit a **Team** is made of, and what one side of the calculator is loaded
from. Type `PokemonConfig`.

### Nature

A **pair** — one boosted stat (×1.1) and one hindered stat (×0.9) — or neutral. There is no
such thing as a lone boost: half a pair names no nature, so the stat display and the damage
engine would disagree about it. See `openspec/specs/granular-nature-selection`.

Stored as the **name** — one of the 25 strings in `NATURES` — and nothing else. The pair is
derived from it, never stored alongside it, so the two cannot drift apart. Read the effect on
a stat through `natureMultiplier(nature, stat)`; never compare stats to a boosted/hindered
field, because there isn't one.

A `+`/`-` press goes through `toggleNature`, which fills the other half of the pair with the
conventional dump stat (Atk, or SpA when tuning Atk) so every press lands on a real nature.

Two seams need the name in other shapes: `bareNature` strips the display decoration for
`@smogon/calc`, and `getNatureStats` recovers the pair for arrows and highlights.

Note the stored name carries its own decoration — `"Adamant (+ATK, -SPA)"` — so it doubles as
the display string. Localising that text would change stored data.

### SP

This project's stat-investment system, in place of EVs. Capped at 32 per stat, 66 total.
HP is `base + 75 + SP`; other stats are `floor((base + 20 + SP) × nature)`.
See `openspec/specs/ev-sp-conversion-logic`.

## Team

### Team

Up to six **Pokémon configs**, named and persisted. See `openspec/specs/team-management`.

### Team member

One **Pokémon config** in the context of a **Team**, carrying its slot order.

## Scan

### Scan

Reading a game screenshot to recover Pokémon. Two kinds, and they are not interchangeable:

- **Player team scan** — the player's own team-preview screen, producing **Pokémon configs**
  complete with SP and moves.
- **Opponent scan** — the opponent's team preview, producing species only, which become a
  **Battle roster**.

### Battle roster

The opponent species confirmed for the current battle. Once locked it masks later scans and
narrows the calculator's defender choices.

## Decisions

Architectural decisions that constrain the above are recorded in `docs/adr/`.
