# Vendored `@smogon/calc`

A compiled build of [smogon/damage-calc](https://github.com/smogon/damage-calc)'s `calc/`
package, pinned to commit `06cc6116714a2dd92cc2fdcee3052bcecf8eb714`
("Champions: Support Regulation M-C", 2026-09-09). The root `package.json` points `@smogon/calc` here
with a `file:` dependency.

## Why not the npm package

The newest npm release is 0.11.0 (March 2026). Since then master gained the Pokémon Champions
mechanics this app needs — the Champions-original Mega abilities (Dragonize, Fire Mane, Mega Sol,
Eelevate, Piercing Drill, and Aura Guard from Regulation M-C), species data for the new Megas,
and the Champions move rebalances (First Impression 100 BP, Slash 80, Snap Trap Steel, …) in its
Champions generation — and no release followed. The package sits in a subfolder of a private monorepo wrapper,
which npm cannot install from git, so the build is committed instead. See
`docs/champions-new-abilities.md` for what the app relies on.

## Refreshing

```bash
scripts/vendor-smogon-calc.sh <commit-sha>
npm install
npm test
```

Source maps, the browser bundle and upstream's compiled tests are not vendored. When an npm release ≥ 0.12 ships
`mechanics/champions`, delete this folder, restore the registry dependency and rerun the tests.
