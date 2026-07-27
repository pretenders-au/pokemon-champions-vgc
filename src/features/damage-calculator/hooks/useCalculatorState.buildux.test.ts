import { describe, it, expect } from 'vitest';
import { sideReducer, initialSide } from './useCalculatorState';
import { NATURES } from '@/features/pokemon/utils/pokemon-natures';
import type { SavedBuild } from '../utils/build-store';
import { getNatureStats } from '@/features/pokemon/utils/pokemon-natures';

describe('build-ux reducer actions', () => {
  it('APPLY_SPREAD sets SP + nature (+ derived stats), leaves ability/item', () => {
    const start = { ...initialSide, activeAbility: 'Intimidate', item: 'Leftovers' };
    const next = sideReducer(start, {
      type: 'APPLY_SPREAD',
      payload: { side: 'p2', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 0, spe: 0 }, nature: 'Bold (+DEF, -ATK)' },
    });
    expect(next.spHp).toBe(32);
    expect(next.spDef).toBe(32);
    expect(next.nature).toBe('Bold (+DEF, -ATK)');
    expect(next.activeAbility).toBe('Intimidate'); // untouched
    expect(next.item).toBe('Leftovers'); // untouched
  });

  it('APPLY_SAVED_BUILD sets SP + nature + ability + item', () => {
    const build: SavedBuild = {
      nature: 'Calm (+SPD, -ATK)', ability: 'Rough Skin', item: 'Sitrus Berry',
      sp: { hp: 32, atk: 0, def: 0, spa: 0, spd: 32, spe: 0 },
    };
    const next = sideReducer(initialSide, { type: 'APPLY_SAVED_BUILD', payload: { side: 'p2', build } });
    expect(next.spSpd).toBe(32);
    expect(next.nature).toBe('Calm (+SPD, -ATK)');
    expect(next.activeAbility).toBe('Rough Skin');
    expect(next.item).toBe('Sitrus Berry');
  });

  it('SET_SP clamps to [0, 32]', () => {
    expect(sideReducer(initialSide, { type: 'SET_SP', payload: { side: 'p1', key: 'spSpa', val: 67 } }).spSpa).toBe(32);
    expect(sideReducer(initialSide, { type: 'SET_SP', payload: { side: 'p1', key: 'spSpa', val: -5 } }).spSpa).toBe(0);
    expect(sideReducer(initialSide, { type: 'SET_SP', payload: { side: 'p1', key: 'spSpa', val: 20 } }).spSpa).toBe(20);
  });

  it('SET_SCAN_LOADED toggles the flag', () => {
    const next = sideReducer(initialSide, { type: 'SET_SCAN_LOADED', payload: { side: 'p2', val: true } });
    expect(next.loadedFromScan).toBe(true);
  });

  it('RESET_BUILD clears SP/nature/item and the flag', () => {
    const dirty = { ...initialSide, spHp: 32, spDef: 32, nature: 'Bold (+DEF, -ATK)', item: 'Leftovers', loadedFromScan: true };
    const next = sideReducer(dirty, { type: 'RESET_BUILD', payload: { side: 'p2' } });
    expect(next.spHp).toBe(0);
    expect(next.spDef).toBe(0);
    expect(next.nature).toBe('Hardy');
    expect(next.item).toBeNull();
    expect(next.loadedFromScan).toBe(false);
  });

  it('TOGGLE_NATURE pairs a boost with the dump stat instead of leaving it half-set', () => {
    const next = sideReducer(initialSide, { type: 'TOGGLE_NATURE', payload: { side: 'p1', stat: 'atk', mod: '+' } });
    expect(next.nature).toBe('Adamant (+ATK, -SPA)');
  });

  it('TOGGLE_NATURE on the boosted stat returns to neutral', () => {
    const boosted = sideReducer(initialSide, { type: 'TOGGLE_NATURE', payload: { side: 'p1', stat: 'spe', mod: '+' } });
    expect(boosted.nature).toBe('Timid (+SPE, -ATK)');
    const back = sideReducer(boosted, { type: 'TOGGLE_NATURE', payload: { side: 'p1', stat: 'spe', mod: '+' } });
    expect(back.nature).toBe('Hardy');
  });

  it('TOGGLE_NATURE can never reach a half-set nature', () => {
    // A lone boost renders x1.1 in the stat display while the damage engine reads neutral.
    let state = initialSide;
    for (const stat of ['atk', 'def', 'spa', 'spd', 'spe']) {
      for (const mod of ['+', '-'] as const) {
        state = sideReducer(state, { type: 'TOGGLE_NATURE', payload: { side: 'p1', stat, mod } });
        // Every reachable nature names a full pair, or none of it.
        const { boostedStat, hinderedStat } = getNatureStats(state.nature);
        expect(Boolean(boostedStat)).toBe(Boolean(hinderedStat));
        expect(NATURES).toContain(state.nature);
      }
    }
  });

  it('initialSide.loadedFromScan defaults false', () => {
    expect(initialSide.loadedFromScan).toBe(false);
  });
});
