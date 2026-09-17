# Champions Mega abilities vs `@smogon/calc`

Seven **Champions-original** Mega abilities exist that the released `@smogon/calc` (0.11.0, the
newest on npm) does not know. Because `@smogon/calc` **silently ignores** an unknown ability (it
does not crash), a Mega with one of these would compute damage *as if it had no ability*.

smogon/damage-calc's master branch models all of them natively (the M-B six since June 2026, Aura
Guard since 2026-09-08) but no release followed, so the app depends on a **vendored build of
master** — `vendor/smogon-calc`, pinned in its README — and `damage-calc.ts` special-cases nothing.

This file records each ability's **confirmed** in-game effect (cross-checked against
Serebii/Bulbapedia — see Sources) and what the vendored engine does with it.

> Note: the original draft of this file *guessed* that Eelevate and Fire Mane were `-ate`
> type-changers like Dragonize. Research disproved that — **only Dragonize is an `-ate`
> ability**. Eelevate is Levitate + Beast Boost; Fire Mane is an unconditional Fire boost. The
> table below reflects the confirmed effects.

## Confirmed effects and handling

| Ability | Mega | Confirmed effect | In the vendored `@smogon/calc` |
|---|---|---|---|
| **Dragonize** | Mega Feraligatr | `-ate` type-changer: Normal-type moves become **Dragon**-type, power ×1.2. | Modelled: Normal moves become Dragon at ~1.2× (`4915/4096`), and the desc names the ability. |
| **Eelevate** | Mega Eelektross | Levitate (immune to Ground moves except Thousand Arrows; ignores Spikes/Toxic Spikes/Sticky Web) **+** Beast Boost (highest non-HP stat +1 on KO). | Partly modelled: listed alongside Levitate for Ground immunity. Beast Boost (on-KO stat boost) is sequential, not part of a single damage calc — not modelled. |
| **Fire Mane** | Mega Pyroar | Fire-type moves power ×1.5, **always active** (unconditional Blaze). | Modelled: ×1.5 attack modifier on Fire moves (`6144/4096`). |
| **Mega Sol** | Mega Meganium | The user's moves behave as if under harsh sunlight, regardless of field weather: Fire ×1.5, Water ×0.5, Weather Ball is Fire-type BP 100, Solar Beam/Blade skip charge & aren't weather-halved, Synthesis/Moonlight/Morning Sun heal ⅔, Thunder/Hurricane accuracy 50%, ignores Rock SpD/Def weather boosts. | Modelled as personal Sun for the attacker: **Fire ×1.5, Water ×0.5, Weather Ball → 100 BP Fire** (all pinned by test). Healing, accuracy and charge effects are outside a single damage calc. |
| **Piercing Drill** | Mega Excadrill | Contact moves hit a **protecting** target, dealing ¼ of the move's damage (everything but the protect is still triggered). | Modelled like Unseen Fist (hits through Protect). This app has no Protect state, so it never changes a number here. |
| **Spicy Spray** | Mega Scovillain | When hit by a damaging move, **burns the attacker** (even on faint / through Substitute by the attacker; not while Scovillain itself is behind a Substitute). | Not modelled upstream either — correct, since it inflicts a status *after* the hit and never changes the incoming hit's damage. |
| **Aura Guard** | Mega Lucario Z (Reg M-C) | Halves the damage the holder takes from **contact** moves. Long Reach contact moves bypass it. | Modelled: ×0.5 final modifier on contact moves, skipped for Long Reach — Fluffy's contact branch without Fluffy's Fire weakness. |

## Implementation notes

- `damage-calc.ts` passes the ability name straight to the engine; there is no Champions
  special-casing left in the app. The earlier hand-rolled overrides (move retype / base-power
  multipliers for Dragonize, Fire Mane and Mega Sol; an Eelevate→Levitate alias) were removed when
  the vendored build arrived, because the engine now applies the same effects and the two together
  would have doubled them.
- `champions-abilities.test.ts` pins every effect above through `calculateSmogonDamage`, so a
  refresh of the vendored build — or a return to the npm package once a release includes
  `mechanics/champions` — cannot silently drop one.
- Refresh with `scripts/vendor-smogon-calc.sh <commit>`; see `vendor/smogon-calc/README.md`.

## Sources

- Dragonize / Mega Sol reveal — Serebii: https://x.com/SerebiiNet/status/2036444426906579390
- Eelevate — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Eelevate_(Ability)
- Fire Mane — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Fire_Mane_(Ability)
- Mega Sol — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Mega_Sol_(Ability)
- Piercing Drill — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Piercing_Drill_(Ability)
- Spicy Spray — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Spicy_Spray_(Ability)
- Aura Guard — Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Aura_Guard_(Ability)
- Upstream mechanics — smogon/damage-calc `calc/src/mechanics/gen789.ts` and `champions.ts`,
  commits "Update Champions for M-B (#813)" and "Champions: Add new megas (#855)"

## Note on ability-less Mega rows

Nine other Champions Mega rows (Mega Zygarde / Heatran / Darkrai / Magearna / Zeraora and the
three Tatsugiri Megas) exist as data with stats but **no ability and no legality in any
regulation** — they are not selectable, so their incomplete data is harmless. Left as-is
intentionally; when a regulation makes one legal, give it its ability the way
`scripts/load_regulation_m_c.py` does for the M-C Megas (the dataset sanity test enforces it).
