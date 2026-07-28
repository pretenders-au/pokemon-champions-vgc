# ADR-0001 — Set resolution matches species with `matchSpecies` only, no loose fallback

- **Status**: Accepted
- **Date**: 2026-07-28
- **Affects**: `src/features/pokemon/utils/showdown-import.ts`, `src/features/pokemon/utils/showdown-matcher.ts`

## Context

Before **set resolution** existed as a module, six call sites each resolved a parsed Showdown
set against the dex. Five used `matchSpecies`. One — the team-detail import at
`useTeamDetail.ts:177-200` — used a hand-rolled chain instead:

1. normalise and exact-match
2. a mega regex, `^([a-z]+)mega([xy])?$`
3. a hardcoded `indeedeef` → `indeedee` case
4. a prefix fallback: `species.split('-')[0]`, exact, then `includes`

When consolidating the six encoders we had to choose which species strategy became canonical.

Measured against the real `vgc_pokemon.db`, steps 1–3 of that chain are redundant or dead:

- `matchSpecies` already contains the **identical** mega regex (`showdown-matcher.ts:133-137`).
- Because `normalize()` strips hyphens and parentheses, Showdown's `Urshifu-Rapid-Strike` and
  the dex's `Urshifu (Rapid Strike)` normalise to the same string. Ordinary form suffixes
  exact-match already: `Tornadus-Therian`, `Rotom-Wash`, `Charizard-Mega-Y`. `Ogerpon-Wellspring`
  resolves fuzzily at 0.81.
- The `indeedeef` case targets a bare `Indeedee` row that does not exist — the dex carries only
  `Indeedee (Male)`, so the substitution never fires.

Step 4, the prefix fallback, is the only part that changes any outcome — and it changes them
for the worse. Because it tries an **exact** match on the prefix before an `includes`, a
form name whose base species is also legal resolves to the base form:

| Showdown name | `matchSpecies` | prefix fallback |
|---|---|---|
| `Tauros-Paldea-Aqua` | `Tauros (Paldea Aqua Breed)` (0.76) | **`Tauros`** — wrong form |
| `Rotom-Wash` | `Rotom (Wash)` (exact) | n/a, exact hits first |

Base Tauros is Normal; the Aqua Breed is Fighting/Water with a different spread. In a damage
calculator that is silently wrong output, with no correction shown to the user. `Tauros`,
`Rotom`, `Pikachu` and `Lycanroc` all have a legal base form plus legal alternate forms in
Regulation M-B, so this is reachable today.

Where the fallback does help is a **dex data gap**: there are no Female rows at all — only
`(Male)` — for any of the seven gendered species. `matchSpecies` therefore fails on the
F-forms, all just under the 0.75 fuzzy threshold:

| Query | Best similarity | Legal in M-B? |
|---|---|---|
| `Meowstic-F` | 0.67 | yes |
| `Basculegion-F` | 0.73 | yes |
| `Pyroar-F` | 0.67 | yes |
| `Indeedee-F`, `Oinkologne-F` | 0.67 / 0.71 | not currently |

The fallback "rescues" these by resolving them to the `(Male)` row — again silently, and again
with a materially different spread.

## Decision

**Set resolution uses `matchSpecies` alone.** No prefix fallback, no per-species alias table.

A species that does not match is a fatal error for that set: no config is produced and the
species is reported in `errors`. Other members of the same import still resolve.

The missing Female rows are a dex data gap, tracked separately. Adding them is the correct fix;
`matchSpecies` will then resolve the F-forms exactly and no fallback is needed anywhere.

## Consequences

- **Fixed:** alternate forms whose base species is also legal now resolve to the correct form on
  the team-detail import path. `Tauros-Paldea-Aqua` gives the Aqua Breed, not base Tauros.
  Verified in the running app.
- ~~**Regressed, accepted:** importing `Meowstic-F`, `Basculegion-F` or `Pyroar-F` now reports
  "Pokémon: Meowstic-F" as unrecognised instead of silently substituting the `(Male)` row.
  Accepted because the alternative is silently wrong damage output.~~
  **Resolved 2026-07-28** — the dex gap is closed and all three import correctly. See below.
- Any future loose matching must surface what it did as a **correction**, never silently. A
  substitution the user cannot see is worse than a failure they can.
- `useTeamDetail`'s `normalizeName`, mega regex and `indeedeef` case were deleted, not ported.

### Follow-up: the dex gap is closed (2026-07-28)

`scripts/add_female_forms.py` adds all seven Female rows to `vgc_pokemon.db` (stats, types and
abilities transcribed from the PokeAPI CSVs the dex was built from), registers them in
`format_pokemon` wherever their species is legal, and re-seeds `calculated_speeds`. Four differ
mechanically from the male (Indeedee, Basculegion, Oinkologne in stats; Meowstic only in its
hidden ability, Prankster → Competitive); Frillish, Jellicent and Pyroar are cosmetic-only.

**The prediction in *Decision* above was wrong**: adding the rows was necessary but not
sufficient. Levenshtein cannot bridge Showdown's `-F` to the dex's `(Female)`. Measured after
the rows landed, `Meowstic-F` scores 0.64 against `Meowstic (Female)` — below the 0.75
threshold *and* below the 0.67 it scores against `Meowstic (Male)`, so it kept returning null.
The same gap made Showdown's bare `Meowstic` — the male form — fail too, which this ADR missed.

`matchSpecies` therefore expands the gender suffix (`-F` → `female`, `-M`/bare → `male`) and
retries the **exact** match. This is not the rejected fallback: it neither truncates the query
nor scans for substrings, so it can only ever land on the same species' other gender row, and
it reports the expansion as a correction per the rule above.

`Oinkologne (Female)` also needed a Smogon mapping — `normalizeSmogonName` only knew three of
the seven gendered species, so `Pyroar (Male)` had been reaching `@smogon/calc` with its
parenthetical intact despite being M-B legal. The mapping is now derived from the suffix.

Two known gaps, neither reachable today: the cosmetic three reuse the male thumbnail (PokeAPI
has no female official artwork), and no `pokemon_moves` rows were added for any Female row —
the scan classifier cannot predict these ids, and the calculator's move picker is unscoped.

## Do not re-suggest

Re-adding a prefix/`includes` species fallback to make F-form imports work. It has been
considered and rejected: it would reintroduce silent wrong-form resolution for `Tauros`,
`Rotom`, `Pikachu` and `Lycanroc`, which is a larger problem than the one it solves. Fix the
dex instead — see the tracked follow-up for adding Female rows to `vgc_pokemon.db`.
