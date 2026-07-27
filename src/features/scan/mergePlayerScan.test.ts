import { describe, it, expect } from 'vitest';
import { solveStatRow, mergePlayerScan, buildConfigs, pickLang } from './mergePlayerScan';
import { championsStat } from '@/features/pokemon/utils/champions-stats';
import type { PlayerScanVocab } from '@/db/repositories/scan.repo';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import { getNatureStats } from '@/features/pokemon/utils/pokemon-natures';

describe('solveStatRow', () => {
  it('exhaustive: unique multiplier recovered for every base/sp/nature combo', () => {
    for (const base of [50, 75, 100, 135, 180]) {
      for (let sp = 0; sp <= 32; sp++) {
        for (const mult of [0.9, 1.0, 1.1] as const) {
          const stat = championsStat(base, sp, mult);
          const arrow = mult === 1.1 ? 'up' : mult === 0.9 ? 'down' : null;
          const r = solveStatRow(base, { stat, sp, arrow });
          expect(r.mult).toBe(mult === 1.0 ? 1 : mult);
          expect(r.consistent).toBe(true);
        }
      }
    }
  });
  it('arrow/math disagreement flags inconsistent, math wins', () => {
    const stat = championsStat(100, 10, 1.0);
    const r = solveStatRow(100, { stat, sp: 10, arrow: 'up' });
    expect(r.mult).toBe(1);
    expect(r.consistent).toBe(false);
  });
  it('auto-repair: bad stat digit, arrow + sp reproduce the row', () => {
    // read stat fits no multiplier; arrow says up; sp read ok
    const r = solveStatRow(100, { stat: 999, sp: 10, arrow: 'up' });
    expect(r.mult).toBe(1.1);
    expect(r.stat).toBe(championsStat(100, 10, 1.1)); // repaired
    expect(r.consistent).toBe(false);
  });
  it('null reads propagate', () => {
    const r = solveStatRow(100, { stat: null, sp: null, arrow: null });
    expect(r.mult).toBeNull();
    expect(r.consistent).toBe(false);
  });
});

describe('nature derivation via merge', () => {
  // build a minimal fake stats scan for one slot: Adamant (atk up, spa down), bases 100 flat
  const bases = { id: 1, identifier: 'x', nameEn: 'X', nameZh: null, type1: 'Water', type2: null,
    baseHp: 100, baseAttack: 100, baseDefense: 100, baseSpAtk: 100, baseSpDef: 100, baseSpeed: 100 } as any;
  const mkRow = (mult: 0.9 | 1 | 1.1, sp = 4) => ({
    stat: championsStat(100, sp, mult), sp, arrow: mult === 1.1 ? 'up' as const : mult === 0.9 ? 'down' as const : null,
  });
  const statsScan = {
    kind: 'stats' as const,
    panels: [{ slot: 0, species: [{ id: 1, score: 0.9 }], rows: [
      { stat: 100 + 75 + 4, sp: 4, arrow: null }, mkRow(1.1), mkRow(1), mkRow(0.9), mkRow(1), mkRow(1),
    ] }],
  };
  it('one up + one down = exact nature, confident', () => {
    const merged = mergePlayerScan(null, statsScan, new Map([[1, bases]]));
    expect(merged.slots[0].nature.name).toContain('Adamant');
    expect(merged.slots[0].nature.confident).toBe(true);
  });
  it('no arrows and all-neutral math = Serious', () => {
    const neutral = { ...statsScan, panels: [{ ...statsScan.panels[0], rows: [
      { stat: 179, sp: 4, arrow: null }, mkRow(1), mkRow(1), mkRow(1), mkRow(1), mkRow(1) ] }] };
    const merged = mergePlayerScan(null, neutral, new Map([[1, bases]]));
    expect(merged.slots[0].nature.name).toContain('Serious');
  });
});

describe('pickLang', () => {
  it('majority-score language wins', () => {
    const f = (en: number, zh: number) => ({ byLang: {
      en: [{ key: 'a', score: en }], ja: [], 'zh-Hant': [{ key: 'a', score: zh }], 'zh-Hans': [],
    } }) as any;
    expect(pickLang([f(0.9, 0.6), f(0.85, 0.5)])).toBe('en');
    expect(pickLang([f(0.6, 0.9), f(0.5, 0.95)])).toBe('zh-Hant');
    expect(pickLang([])).toBeNull();
  });
});

describe('buildConfigs', () => {
  const bases = { id: 1, identifier: 'x', nameEn: 'X', nameZh: null, type1: 'Water', type2: null,
    baseHp: 100, baseAttack: 100, baseDefense: 100, baseSpAtk: 100, baseSpDef: 100, baseSpeed: 100 } as any;
  const mkRow = (mult: 0.9 | 1 | 1.1, sp = 4) => ({
    stat: championsStat(100, sp, mult), sp, arrow: mult === 1.1 ? 'up' as const : mult === 0.9 ? 'down' as const : null,
  });
  const statsScan = {
    kind: 'stats' as const,
    panels: [{ slot: 0, species: [{ id: 1, score: 0.9 }], rows: [
      { stat: 100 + 75 + 4, sp: 4, arrow: null }, mkRow(1.1), mkRow(1), mkRow(0.9), mkRow(1), mkRow(1),
    ] }],
  };
  const movesScan = {
    kind: 'moves' as const,
    panels: [{
      slot: 0, species: [{ id: 1, score: 0.9 }],
      ability: { byLang: { en: [{ key: 'Static', score: 0.9 }], ja: [], 'zh-Hant': [], 'zh-Hans': [] } },
      item: { byLang: { en: [{ key: 'Leftovers', score: 0.9 }], ja: [], 'zh-Hant': [], 'zh-Hans': [] } },
      moves: [
        { byLang: { en: [{ key: '1', score: 0.9 }], ja: [], 'zh-Hant': [], 'zh-Hans': [] } },
        { byLang: { en: [{ key: '182', score: 0.9 }], ja: [], 'zh-Hant': [], 'zh-Hans': [] } },
        null, null,
      ],
    }],
  };

  const movesById = new Map<number, MoveData>([
    [1, { id: 1, identifier: 'pound', nameEn: 'Pound', nameJa: null, nameZh: null, typeId: 1, damageClassId: 2, power: 40, accuracy: 100, pp: 35, priority: 0 }],
    [182, { id: 182, identifier: 'protect', nameEn: 'Protect', nameJa: null, nameZh: null, typeId: 1, damageClassId: 2, power: null, accuracy: null, pp: 10, priority: 4 }],
  ]);
  const vocab: PlayerScanVocab = {
    movesFor: () => [],
    abilitiesFor: (id) => id === 1 ? [{ key: 'Static', names: { en: 'Static', ja: null, zhHant: null, zhHans: null } }] : [],
    items: [],
  };

  it('one merged slot builds a PokemonConfig matching statReads/nature/moves/abilities', () => {
    const merged = mergePlayerScan(movesScan, statsScan, new Map([[1, bases]]));
    const configs = buildConfigs(merged, new Map([[1, bases]]), movesById, vocab);
    expect(configs).toHaveLength(1);
    const c = configs[0];
    expect(c.selectedId).toBe(1);
    expect(c.baseHp).toBe(100);
    expect(c.baseAtk).toBe(100);
    expect(c.spHp).toBe(4);
    expect(c.spAtk).toBe(4);
    expect(c.spSpa).toBe(4);
    expect(c.nature).toContain('Adamant');
    expect(getNatureStats(c.nature)).toEqual({ boostedStat: 'atk', hinderedStat: 'spa' });
    expect(c.moves.map(m => m?.nameEn ?? null)).toEqual(['Pound', 'Protect', null, null]);
    expect(c.activeAbility).toBe('Static');
    expect(c.item).toBe('Leftovers');
    expect(c.abilities).toEqual(['Static']);
    expect(c.hpPercent).toBe(100);
    expect(c.activeMoveIndex).toBe(0);
    expect(c.isTypeOverridden).toBe(false);
  });

  it('skips slots with no species candidate', () => {
    const emptyStats = { kind: 'stats' as const, panels: [{ slot: 0, species: [], rows: statsScan.panels[0].rows }] };
    const merged = mergePlayerScan(null, emptyStats, new Map());
    const configs = buildConfigs(merged, new Map(), movesById, vocab);
    expect(configs).toHaveLength(0);
  });
});
