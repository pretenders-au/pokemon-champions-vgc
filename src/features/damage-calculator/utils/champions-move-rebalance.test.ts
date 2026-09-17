import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { Generations, toID } from '@smogon/calc'
import { mapToSmogonMove } from '@/features/damage-calculator/utils/damage-calc'

// Pokémon Champions rebalances some moves. The vendored @smogon/calc keeps those numbers in its
// Champions generation (gen 0); the engine runs gen 9 mechanics and borrows them per move.
// See docs/champions-new-abilities.md, "Champions move rebalances".

describe('Champions move rebalances', () => {
  it('borrows the Champions base power where it differs from gen 9', () => {
    expect(mapToSmogonMove('First Impression').bp).toBe(100) // 90 in the main series
    expect(mapToSmogonMove('Slash').bp).toBe(80) // 70
    expect(mapToSmogonMove('Earthquake').bp).toBe(100) // unchanged
  })

  it('borrows the Champions type', () => {
    expect(mapToSmogonMove('Snap Trap').type).toBe('Steel') // Grass in the main series
  })

  it('lets an explicit custom base power win', () => {
    expect(mapToSmogonMove('Last Respects', false, undefined, 150).bp).toBe(150)
  })

  it('the dex moves table shows the same power and type the engine uses', () => {
    const db = new Database('vgc_pokemon.db', { readonly: true })
    const rows = db
      .prepare('SELECT m.name_en, m.power, t.identifier AS type FROM moves m JOIN types t ON t.id = m.type_id')
      .all() as { name_en: string; power: number | null; type: string }[]
    const champions = Generations.get(0)
    const main = Generations.get(9)
    const mismatches: string[] = []
    for (const r of rows) {
      const c = champions.moves.get(toID(r.name_en))
      const m = main.moves.get(toID(r.name_en))
      if (!c || !m) continue
      if (c.basePower !== undefined && c.basePower !== m.basePower && r.power !== c.basePower) {
        mismatches.push(`${r.name_en}: dex power ${r.power}, Champions ${c.basePower}`)
      }
      if (c.type && c.type !== m.type && r.type !== c.type.toLowerCase()) {
        mismatches.push(`${r.name_en}: dex type ${r.type}, Champions ${c.type}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})
