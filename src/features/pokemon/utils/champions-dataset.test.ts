import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { mapToSmogonPokemon, mapToSmogonMove, mapToSmogonField, calculateSmogonDamage } from '@/features/damage-calculator/utils/damage-calc'
import { championsStat } from '@/features/pokemon/utils/champions-stats'

const db = new Database('vgc_pokemon.db', { readonly: true })
const q = (sql: string): any[][] => db.prepare(sql).raw().all() as any[][]

describe('Champions dataset sanity', () => {
  it('has both regulations, each non-empty, M-B at least as large as M-A', () => {
    const rows = q("SELECT name,(SELECT COUNT(*) FROM format_pokemon fp WHERE fp.format_id=f.id) FROM formats f")
    const m = Object.fromEntries(rows.map(([n, c]) => [n as string, c as number]))
    expect(m['Regulation M-A']).toBeGreaterThan(0)
    expect(m['Regulation M-B']).toBeGreaterThan(0)
    expect(m['Regulation M-B']).toBeGreaterThanOrEqual(m['Regulation M-A'])
  })

  it('every LEGAL mega has 6 base stats and >=1 ability', () => {
    // Only megas legal in some format are user-selectable. ~14 Champions Mega rows exist as
    // data but are legal in no regulation; their incomplete abilities are harmless and out
    // of scope (see docs/champions-new-abilities.md).
    const bad = q(`SELECT p.identifier FROM pokemon_forms f JOIN pokemon p ON p.id=f.pokemon_id
      WHERE f.is_mega=1 AND EXISTS(SELECT 1 FROM format_pokemon fp WHERE fp.pokemon_id=p.id)
        AND (p.base_hp IS NULL OR p.base_speed IS NULL
          OR (SELECT COUNT(*) FROM pokemon_abilities pa WHERE pa.pokemon_id=p.id)=0)`)
    expect(bad).toEqual([])
  })

  it('no format_pokemon row points at a missing pokemon', () => {
    expect(q("SELECT COUNT(*) FROM format_pokemon fp LEFT JOIN pokemon p ON p.id=fp.pokemon_id WHERE p.id IS NULL")[0][0]).toBe(0)
  })

  it('every format-legal pokemon has a calculated_speeds row (so speed tiers list all legal mons)', () => {
    const missing = q(`SELECT DISTINCT p.identifier FROM pokemon p
      JOIN format_pokemon fp ON fp.pokemon_id = p.id
      LEFT JOIN calculated_speeds cs ON cs.pokemon_id = p.id
      WHERE cs.pokemon_id IS NULL`)
    expect(missing).toEqual([])
  })
})

// Mega Raichu Y is a Champions-original Mega @smogon/calc has NO species data for, so these
// tests prove the dataset's Mega stats flow through the Spec-1 base-stat override path.
// (External ChampDex %-parity is a manual cross-check, as in Spec 1; engine↔ChampDex parity
// was already established there — here we verify the new Mega DATA reaches the engine.)
const stateFor = (o: Record<string, unknown> = {}) => ({
  isTypeOverridden: false, type1: 'electric', type2: null,
  baseHp: 60, baseAtk: 100, baseDef: 55, baseSpa: 160, baseSpd: 80, baseSpe: 130,
  nature: 'Hardy',
  spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
  stages: {}, boostedStat: null, hinderedStat: null, hpPercent: 100,
  activeAbility: null, item: null,
  isReflect: false, isLightScreen: false, isAuroraVeil: false,
  isHelpingHand: false, isFriendGuard: false, isTailwind: false,
  ...o,
})

describe('Champions Mega flows into the engine', () => {
  it('Mega Raichu Y uses its DB Mega SpA via the base-stat override path', () => {
    const spa = q("SELECT base_sp_atk FROM pokemon WHERE identifier='raichu-mega-y'")[0][0] as number
    const p = mapToSmogonPokemon(stateFor({ baseSpa: spa }), 'Mega Raichu Y', 'electric', null)
    expect(p.rawStats.spa).toBe(championsStat(spa, 0, 1.0)) // (160 + 20) * 1 = 180
    expect(p.rawStats.spa).toBe(180)
  })

  it('Mega Raichu Y out-damages base Raichu with the same special move', () => {
    const defender = mapToSmogonPokemon(
      { ...stateFor(), baseHp: 100, baseAtk: 100, baseDef: 100, baseSpa: 100, baseSpd: 100, baseSpe: 100 },
      'TestDummy', 'normal', null)
    const move = mapToSmogonMove('Thunderbolt', false)
    const field = mapToSmogonField('None', false, false, false, false, 'None', false, {}, {})
    const mega = mapToSmogonPokemon(stateFor({ baseSpa: 160 }), 'Mega Raichu Y', 'electric', null)
    const base = mapToSmogonPokemon(stateFor({ baseSpa: 90, baseAtk: 90, baseSpe: 110 }), 'Raichu', 'electric', null)
    const megaDmg = (calculateSmogonDamage(mega, defender, move, field).damage as number[])[0]
    const baseDmg = (calculateSmogonDamage(base, defender, move, field).damage as number[])[0]
    expect(megaDmg).toBeGreaterThan(baseDmg)
  })
})
