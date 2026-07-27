import { describe, it, expect } from 'vitest'
import { mapToSmogonPokemon, mapToSmogonMove, mapToSmogonField, calculateSmogonDamage } from '@/features/damage-calculator/utils/damage-calc'
import { championsStat, championsHP } from '@/features/pokemon/utils/champions-stats'

const stateFor = (overrides: Record<string, unknown> = {}) => ({
  isTypeOverridden: false,
  type1: 'dragon', type2: 'ground',
  baseHp: 100, baseAtk: 100, baseDef: 100, baseSpa: 100, baseSpd: 100, baseSpe: 100,
  spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
  stages: {},
  nature: 'Hardy',
  hpPercent: 100,
  activeAbility: null, item: null,
  isReflect: false, isLightScreen: false, isAuroraVeil: false,
  isHelpingHand: false, isFriendGuard: false, isTailwind: false,
  ...overrides,
})

describe('mapToSmogonPokemon Champions stat override', () => {
  it('pins rawStats to hand-computed Champions stats (not SP-as-EV)', () => {
    const p = mapToSmogonPokemon(stateFor({ spAtk: 32 }), 'Garchomp', 'dragon', 'ground')
    // Champions: (100 + 20 + 32) * 1.0 = 152.  The OLD SP-as-EV path gave 124.
    expect(p.rawStats.atk).toBe(championsStat(100, 32, 1.0))
    expect(p.rawStats.atk).toBe(152)
    expect(p.rawStats.hp).toBe(championsHP(100, 0))
    expect(p.rawStats.hp).toBe(175)
  })

  it('applies nature to the overridden stat', () => {
    const p = mapToSmogonPokemon(stateFor({ nature: 'Adamant (+ATK, -SPA)' }), 'Garchomp', 'dragon', 'ground')
    expect(p.rawStats.atk).toBe(championsStat(100, 0, 1.1)) // 132
    expect(p.rawStats.spa).toBe(championsStat(100, 0, 0.9)) // 108
  })
})

describe('damage responds to SP investment (clone-safe: proves override reaches calculate())', () => {
  it('more attacker SP yields more damage', () => {
    const defender = mapToSmogonPokemon(stateFor({}), 'Tyranitar', 'rock', 'dark')
    const move = mapToSmogonMove('Earthquake', false)
    const field = mapToSmogonField('None', false, false, false, false, 'None', false, {}, {})

    const lowAtk = mapToSmogonPokemon(stateFor({ spAtk: 0 }), 'Garchomp', 'dragon', 'ground')
    const highAtk = mapToSmogonPokemon(stateFor({ spAtk: 32 }), 'Garchomp', 'dragon', 'ground')

    const lowDmg = (calculateSmogonDamage(lowAtk, defender, move, field).damage as number[])[0]
    const highDmg = (calculateSmogonDamage(highAtk, defender, move, field).damage as number[])[0]

    expect(highDmg).toBeGreaterThan(lowDmg)
  })
})
