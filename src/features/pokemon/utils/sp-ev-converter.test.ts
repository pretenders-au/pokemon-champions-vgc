import { describe, it, expect } from 'vitest'
import {
  convertSpToEv, convertEvToSp, capSpToBudget, isOverSpBudget, SP_TOTAL,
} from '@/features/pokemon/utils/sp-ev-converter'

describe('convertSpToEv (official Pokémon HOME mapping)', () => {
  it('maps 0 SP to 0 EV', () => {
    expect(convertSpToEv(0)).toBe(0)
  })
  it('maps the first SP to 4 EV, then +8 each', () => {
    expect(convertSpToEv(1)).toBe(4)
    expect(convertSpToEv(2)).toBe(12)
    expect(convertSpToEv(31)).toBe(244)
  })
  it('caps 32 SP at 252 EV', () => {
    expect(convertSpToEv(32)).toBe(252)
  })
})

describe('convertEvToSp', () => {
  it('maps boundary EV values back to SP', () => {
    expect(convertEvToSp(0)).toBe(0)
    expect(convertEvToSp(4)).toBe(1)
    expect(convertEvToSp(12)).toBe(2)
    expect(convertEvToSp(252)).toBe(32)
  })
})

describe('capSpToBudget', () => {
  // Two editing surfaces clamp with this — StatGrid and the mobile review card. They had
  // separate copies of the arithmetic.
  it('lets a value through when the budget has room', () => {
    expect(capSpToBudget(20, 30, 10)).toBe(20) // others use 20, so 46 is free
  })

  it('caps at the headroom left by the other five stats', () => {
    expect(capSpToBudget(32, 60, 10)).toBe(16) // others use 50, so 16 is left
  })

  it('returns 0 when the other five already spend the whole budget', () => {
    expect(capSpToBudget(32, SP_TOTAL, 0)).toBe(0)
  })

  it('never returns negative when a spread is already over budget', () => {
    expect(capSpToBudget(10, 80, 0)).toBe(0)
  })

  it('lets a stat keep its own value — its current SP is not double-counted', () => {
    // All 66 spent, 32 of it on this stat: re-setting it to 32 must still be allowed.
    expect(capSpToBudget(32, SP_TOTAL, 32)).toBe(32)
  })
})

describe('isOverSpBudget', () => {
  it('is false at exactly the budget', () => {
    expect(isOverSpBudget(SP_TOTAL)).toBe(false)
  })
  it('is true one past it', () => {
    expect(isOverSpBudget(SP_TOTAL + 1)).toBe(true)
  })
})

describe('SP↔EV round-trip', () => {
  it('round-trips at boundaries', () => {
    for (const sp of [0, 1, 2, 31, 32]) {
      expect(convertEvToSp(convertSpToEv(sp))).toBe(sp)
    }
  })
})
