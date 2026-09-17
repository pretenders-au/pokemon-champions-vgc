import { describe, it, expect } from 'vitest'
import {
  mapToSmogonPokemon,
  mapToSmogonMove,
  mapToSmogonField,
  calculateSmogonDamage,
} from '@/features/damage-calculator/utils/damage-calc'

// Champions-original Mega abilities. The released @smogon/calc (0.11.0) does not know them;
// the vendored build of smogon/damage-calc master (vendor/smogon-calc) models them natively and
// the engine passes the ability name straight through. These tests pin that a refresh of the
// vendored build — or a return to the npm package — cannot silently drop one.
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

const mon = (ability: string | null, name: string, type1: string, type2: string | null = null) =>
  mapToSmogonPokemon(stateFor({ activeAbility: ability }), name, type1, type2)

// @smogon/calc returns a number 0 (not an array) for immune hits.
const minDamage = (a: any, d: any, m: any): number => {
  const r = calculateSmogonDamage(a, d, m, field).damage
  return Array.isArray(r) ? (r[0] as number) : (r as number)
}

/** Min-roll damage with `ability` on one side of the matchup, divided by the same matchup without it. */
const abilityRatio = (side: 'attacker' | 'defender', ability: string, type: string, other: any, moveName: string) => {
  const move = mapToSmogonMove(moveName)
  const withIt = mon(ability, 'X', type)
  const without = mon(null, 'X', type)
  return side === 'attacker'
    ? minDamage(withIt, other, move) / minDamage(without, other, move)
    : minDamage(other, withIt, move) / minDamage(other, without, move)
}

describe('Dragonize (Mega Feraligatr): Normal -> Dragon, ~1.2x', () => {
  it('lets a Normal move hit a Ghost (Normal is immune; Dragon is not)', () => {
    const ghost = mon(null, 'GhostWall', 'ghost')
    const bodySlam = mapToSmogonMove('Body Slam')
    expect(minDamage(mon(null, 'A', 'water'), ghost, bodySlam)).toBe(0)
    expect(minDamage(mon('Dragonize', 'A', 'water'), ghost, bodySlam)).toBeGreaterThan(0)
  })

  it('applies a ~1.2x boost (isolated from STAB/effectiveness) and names itself in the desc', () => {
    // Attacker is Water (no Normal or Dragon STAB); defender Electric (Normal & Dragon both 1x).
    const electric = mon(null, 'D', 'electric')
    const ratio = abilityRatio('attacker', 'Dragonize', 'water', electric, 'Body Slam')
    expect(ratio).toBeGreaterThan(1.12)
    expect(ratio).toBeLessThan(1.28)
    expect(calculateSmogonDamage(mon('Dragonize', 'A', 'water'), electric, mapToSmogonMove('Body Slam'), field).desc())
      .toContain('Dragonize')
  })
})

describe('Fire Mane (Mega Pyroar): Fire moves x1.5, always on', () => {
  const normal = mon(null, 'D', 'normal') // Fire vs Normal = 1x

  it('increases Fire-move damage ~1.5x (isolated from STAB/effectiveness)', () => {
    const ratio = abilityRatio('attacker', 'Fire Mane', 'normal', normal, 'Flamethrower')
    expect(ratio).toBeGreaterThan(1.42)
    expect(ratio).toBeLessThan(1.58)
  })

  it('does not touch non-Fire moves', () => {
    expect(abilityRatio('attacker', 'Fire Mane', 'normal', normal, 'Thunderbolt')).toBe(1)
  })
})

describe('Mega Sol (Mega Meganium): personal harsh sunlight', () => {
  const normal = mon(null, 'D', 'normal')

  it('boosts Fire moves ~x1.5 and halves Water moves', () => {
    const fire = abilityRatio('attacker', 'Mega Sol', 'grass', normal, 'Flamethrower')
    expect(fire).toBeGreaterThan(1.42)
    expect(fire).toBeLessThan(1.58)
    const water = abilityRatio('attacker', 'Mega Sol', 'grass', normal, 'Surf')
    expect(water).toBeGreaterThan(0.45)
    expect(water).toBeLessThan(0.55)
  })

  it('turns Weather Ball into a 100 BP Fire move with no field weather', () => {
    const desc = calculateSmogonDamage(mon('Mega Sol', 'M', 'grass'), normal, mapToSmogonMove('Weather Ball'), field).desc()
    expect(desc).toContain('Weather Ball (100 BP Fire)')
  })

  it('does not touch non-Fire/Water moves', () => {
    expect(abilityRatio('attacker', 'Mega Sol', 'grass', normal, 'Earthquake')).toBe(1)
  })
})

describe('Eelevate (Mega Eelektross): Levitate (Ground immunity) + Beast Boost', () => {
  it('makes the holder immune to Ground moves', () => {
    const attacker = mon(null, 'A', 'ground')
    const eq = mapToSmogonMove('Earthquake')
    expect(minDamage(attacker, mon(null, 'PlainDef', 'electric'), eq)).toBeGreaterThan(0)
    expect(minDamage(attacker, mon('Eelevate', 'MEelektross', 'electric'), eq)).toBe(0)
  })

  it('does not change damage from non-Ground moves', () => {
    expect(abilityRatio('defender', 'Eelevate', 'electric', mon(null, 'A', 'water'), 'Surf')).toBe(1)
  })
})

describe('Aura Guard (Mega Lucario Z): halves damage from contact moves', () => {
  const attacker = mon(null, 'A', 'normal')

  it('halves a contact move', () => {
    const ratio = abilityRatio('defender', 'Aura Guard', 'normal', attacker, 'Body Slam')
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })

  it('does not touch a non-contact move', () => {
    expect(abilityRatio('defender', 'Aura Guard', 'normal', attacker, 'Hyper Voice')).toBe(1)
  })
})

describe('Utility abilities with no damage-calc impact', () => {
  it('Piercing Drill does not change a contact move (the calc has no Protect state)', () => {
    expect(abilityRatio('attacker', 'Piercing Drill', 'ground', mon(null, 'D', 'normal'), 'Close Combat')).toBe(1)
  })

  it('Spicy Spray does not change incoming damage (burn is applied after the hit)', () => {
    expect(abilityRatio('defender', 'Spicy Spray', 'grass', mon(null, 'A', 'normal'), 'Body Slam')).toBe(1)
  })
})
