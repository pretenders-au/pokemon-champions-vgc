import { describe, it, expect } from 'vitest'
import {
  mapToSmogonPokemon,
  mapToSmogonMove,
  mapToSmogonField,
  calculateSmogonDamage,
} from '@/features/damage-calculator/utils/damage-calc'

// Champions-original Mega abilities that @smogon/calc does not model.
// See docs/champions-new-abilities.md for confirmed effects + sources.

const stateFor = (o: Record<string, unknown> = {}) => ({
  isTypeOverridden: false,
  type1: 'normal', type2: null,
  baseHp: 100, baseAtk: 130, baseDef: 100, baseSpa: 130, baseSpd: 100, baseSpe: 100,
  nature: 'Hardy',
  spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
  stages: {}, boostedStat: null, hinderedStat: null, hpPercent: 100,
  activeAbility: null, item: null,
  isReflect: false, isLightScreen: false, isAuroraVeil: false,
  isHelpingHand: false, isFriendGuard: false, isTailwind: false,
  faintedCount: 0,
  ...o,
})

const field = mapToSmogonField('None', false, false, false, false, 'None', false, {}, {})

// @smogon/calc returns a number 0 (not an array) for immune hits.
const minDamage = (a: any, d: any, m: any): number => {
  const r = calculateSmogonDamage(a, d, m, field).damage
  return Array.isArray(r) ? (r[0] as number) : (r as number)
}

describe('Dragonize (Mega Feraligatr): Normal -> Dragon, ~1.2x', () => {
  it('retypes a Normal move to Dragon and boosts BP ~1.2x', () => {
    const move = mapToSmogonMove('Body Slam', false, undefined, undefined, 'Dragonize')
    expect(move.type).toBe('Dragon')
    // Body Slam 85 BP * 4915/4096 = 101.97 -> 102
    expect(move.bp).toBe(102)
  })

  it('lets a Normal move hit a Ghost (Normal is immune; Dragon is not)', () => {
    const attacker = mapToSmogonPokemon(stateFor({ activeAbility: 'Dragonize' }), 'MFeraligatr', 'water', 'dragon')
    const ghost = mapToSmogonPokemon(stateFor({}), 'GhostWall', 'ghost', null)

    const plain = mapToSmogonMove('Body Slam', false)
    const dragonized = mapToSmogonMove('Body Slam', false, undefined, undefined, 'Dragonize')

    expect(minDamage(attacker, ghost, plain)).toBe(0)
    expect(minDamage(attacker, ghost, dragonized)).toBeGreaterThan(0)
  })

  it('applies a ~1.2x damage boost (isolated from STAB/effectiveness)', () => {
    // Attacker is Water (no Normal or Dragon STAB); defender Electric (Normal & Dragon both 1x).
    const attacker = mapToSmogonPokemon(stateFor({ activeAbility: 'Dragonize' }), 'A', 'water', null)
    const defender = mapToSmogonPokemon(stateFor({}), 'D', 'electric', null)

    const plain = mapToSmogonMove('Body Slam', false)
    const dragonized = mapToSmogonMove('Body Slam', false, undefined, undefined, 'Dragonize')

    const ratio = minDamage(attacker, defender, dragonized) / minDamage(attacker, defender, plain)
    expect(ratio).toBeGreaterThan(1.12)
    expect(ratio).toBeLessThan(1.28)
  })
})

describe('Fire Mane (Mega Pyroar): Fire moves x1.5, always on', () => {
  it('boosts a Fire move BP by 1.5x', () => {
    const move = mapToSmogonMove('Flamethrower', false, undefined, undefined, 'Fire Mane')
    expect(move.bp).toBe(135) // 90 * 1.5
  })

  it('increases Fire-move damage ~1.5x (isolated from STAB/effectiveness)', () => {
    const attacker = mapToSmogonPokemon(stateFor({ activeAbility: 'Fire Mane' }), 'P', 'normal', null)
    const defender = mapToSmogonPokemon(stateFor({}), 'D', 'normal', null) // Fire vs Normal = 1x

    const plain = mapToSmogonMove('Flamethrower', false)
    const boosted = mapToSmogonMove('Flamethrower', false, undefined, undefined, 'Fire Mane')

    const ratio = minDamage(attacker, defender, boosted) / minDamage(attacker, defender, plain)
    expect(ratio).toBeGreaterThan(1.42)
    expect(ratio).toBeLessThan(1.58)
  })

  it('does not touch non-Fire moves', () => {
    const move = mapToSmogonMove('Thunderbolt', false, undefined, undefined, 'Fire Mane')
    expect(move.bp).toBe(90)
    expect(move.type).toBe('Electric')
  })
})

describe('Mega Sol (Mega Meganium): personal harsh sunlight', () => {
  it('boosts Fire moves x1.5', () => {
    const move = mapToSmogonMove('Flamethrower', false, undefined, undefined, 'Mega Sol')
    expect(move.bp).toBe(135) // 90 * 1.5
  })

  it('halves Water moves x0.5', () => {
    const move = mapToSmogonMove('Surf', false, undefined, undefined, 'Mega Sol')
    expect(move.bp).toBe(45) // 90 * 0.5
  })

  it('increases Fire-move damage and decreases Water-move damage', () => {
    const attacker = mapToSmogonPokemon(stateFor({ activeAbility: 'Mega Sol' }), 'M', 'grass', null)
    const defender = mapToSmogonPokemon(stateFor({}), 'D', 'normal', null)

    const firePlain = mapToSmogonMove('Flamethrower', false)
    const fireSol = mapToSmogonMove('Flamethrower', false, undefined, undefined, 'Mega Sol')
    expect(minDamage(attacker, defender, fireSol)).toBeGreaterThan(minDamage(attacker, defender, firePlain))

    const waterPlain = mapToSmogonMove('Surf', false)
    const waterSol = mapToSmogonMove('Surf', false, undefined, undefined, 'Mega Sol')
    expect(minDamage(attacker, defender, waterSol)).toBeLessThan(minDamage(attacker, defender, waterPlain))
  })

  it('does not touch non-Fire/Water moves', () => {
    const move = mapToSmogonMove('Earthquake', false, undefined, undefined, 'Mega Sol')
    expect(move.bp).toBe(100)
    expect(move.type).toBe('Ground')
  })
})

describe('Eelevate (Mega Eelektross): Levitate (Ground immunity) + Beast Boost', () => {
  it('makes the holder immune to Ground moves', () => {
    const attacker = mapToSmogonPokemon(stateFor({}), 'A', 'ground', null)
    const eelektross = mapToSmogonPokemon(stateFor({ activeAbility: 'Eelevate' }), 'MEelektross', 'electric', null)
    const plainDef = mapToSmogonPokemon(stateFor({}), 'PlainDef', 'electric', null)

    const eq = mapToSmogonMove('Earthquake', false)
    expect(minDamage(attacker, plainDef, eq)).toBeGreaterThan(0)
    expect(minDamage(attacker, eelektross, eq)).toBe(0)
  })

  it('does not change damage from non-Ground moves', () => {
    const attacker = mapToSmogonPokemon(stateFor({}), 'A', 'water', null)
    const eelektross = mapToSmogonPokemon(stateFor({ activeAbility: 'Eelevate' }), 'MEelektross', 'electric', null)
    const plainDef = mapToSmogonPokemon(stateFor({}), 'PlainDef', 'electric', null)

    const surf = mapToSmogonMove('Surf', false)
    expect(minDamage(attacker, eelektross, surf)).toBe(minDamage(attacker, plainDef, surf))
  })
})

describe('Utility abilities with no damage-calc impact', () => {
  it('Piercing Drill does not change a contact move (no Protect state in the calc)', () => {
    const attacker = mapToSmogonPokemon(stateFor({ activeAbility: 'Piercing Drill' }), 'MExcadrill', 'ground', 'steel')
    const defender = mapToSmogonPokemon(stateFor({}), 'D', 'normal', null)

    const plain = mapToSmogonMove('Close Combat', false)
    const withAbility = mapToSmogonMove('Close Combat', false, undefined, undefined, 'Piercing Drill')

    expect(withAbility.bp).toBe(plain.bp)
    expect(withAbility.type).toBe(plain.type)
    expect(minDamage(attacker, defender, withAbility)).toBe(minDamage(attacker, defender, plain))
  })

  it('Spicy Spray does not change incoming damage (burn is applied after the hit)', () => {
    const attacker = mapToSmogonPokemon(stateFor({}), 'A', 'normal', null)
    const scovillain = mapToSmogonPokemon(stateFor({ activeAbility: 'Spicy Spray' }), 'MScovillain', 'grass', 'fire')
    const plainDef = mapToSmogonPokemon(stateFor({}), 'PlainDef', 'grass', 'fire')

    const move = mapToSmogonMove('Body Slam', false)
    expect(minDamage(attacker, scovillain, move)).toBe(minDamage(attacker, plainDef, move))
  })
})
