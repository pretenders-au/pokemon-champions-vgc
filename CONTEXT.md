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

Persisted as the **name** — one of the 25 strings in `NATURES` — and nothing else. Neither
`PokemonConfig` nor the calculator's side state carries a boosted/hindered field, so the name
and the pair cannot drift apart. Read the effect on a stat through
`natureMultiplier(nature, stat)`; never compare a stat to a boosted/hindered field, because
there isn't one to compare against.

An editing surface may hold the pair as transient local state while the user works — the team
review card does — but it resolves back to a name before anything is saved.

Two surfaces edit a nature, and **they must agree**: the desktop `+`/`-` buttons go through
`toggleNature`, the landscape wheel and the review card through `natureForStatWheel`. Both
share one rule — setting one half keeps the opposite half if there is one, and otherwise pairs
with the conventional dump stat (Atk, or SpA when tuning Atk). Tuning Def while SpA is already
dumped gives Impish, not Bold. `toggleNature` adds only "press the stat that is already set to
return to neutral". `nature-wheel.test.ts` asserts the two agree for every nature and stat; if
you add a third surface, put it through the same pair.

Three seams need the name in other shapes: `bareNature` strips the display decoration for
`@smogon/calc`, `getNatureStats` recovers the pair for arrows and highlights, and
`natureArrows` renders the compact `↑C ↓A` card form.

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

Three screens confirm one — the overlay bubble popup, the Scan-opponent page and the
calculator's scan modal — and all three share one model, `features/scan/roster.ts`. They must:
a scan result cannot be trustworthy on one screen and doubtful on another, and a roster
confirmed in one place is the same roster.

A team cannot field the same species twice (Species Clause), so a duplicate **within one side**
is always a misread and the seed re-picks it, choosing the combination with the most identified
slots and then the highest total confidence. Both teams may bring the same Pokémon, so the
sides are solved separately and a mirror match survives.

A team-preview scan reports **both** sides. Only the opponent's is persisted — a preview where
fewer than six opponent cards were detected leaves player slots among the first six, so the
side filter lives in `opponentIdsFromEntries` rather than in each caller.

## Presentation

### Viewport mode

Which of the three app frames a screen renders in. One source, `useViewportMode()`:

- **`arena`** — portrait mobile width (≤ 767px).
- **`arena-landscape`** — landscape orientation at phone height (≤ 767px), plus touch tablets
  up to iPad-Pro height held sideways, gated on `pointer: coarse` so a laptop in a short window
  isn't routed to the touch HUD. Wins over `arena`.
- **`desktop`** — everything else. Note it starts at **768px** wide, not at 1024: a desktop
  window can be narrower than the `max-w-5xl` its pages cap at.

**Hosts read it; leaves are told.** Every caller is a host — `Layout`, the five page roots, and
the Android `OverlayApp`. A leaf that branches on layout takes a prop instead, so whoever
renders it decides: `ArenaAddTeam`, `ArenaReviewMon` and `ArenaPlayerScanReview` each take
`portrait: boolean`. A leaf that calls the hook cannot be told what to render, which is how
desktop came to inherit a layout nobody had chosen for it.

Three modes, two layouts. Desktop passes `portrait={false}` and renders the landscape branch
deliberately — the measurements are in `docs/adr/0002`.

Lives in `src/hooks/useViewportMode.ts`.

## Decisions

Architectural decisions that constrain the above are recorded in `docs/adr/`.
