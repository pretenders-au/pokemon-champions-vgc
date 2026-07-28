import { describe, it, expect } from 'vitest';
import {
  NATURES, NEUTRAL_NATURE, natureForStatWheel, natureWheelIndex, toggleNature,
  getNatureStats, getNatureFromStats,
} from './pokemon-natures';

// The landscape Nature wheel controls the attacker's offensive stat (atk/spa) or the
// defender's defensive stat (def/spd). Regression: a lone boost (a boosted stat with no
// hindered one) resolves to a neutral nature, so @smogon/calc applies no boost and the
// wheel silently does nothing to the damage.

const STATS = ['atk', 'def', 'spa', 'spd', 'spe'];

describe('natureForStatWheel', () => {
  it('the lone-boost bug: an unpaired boost is neutral', () => {
    // What the broken wheel effectively produced.
    expect(getNatureFromStats('spa', null)).toBe(NEUTRAL_NATURE);
  });

  it('boost (target 2) is a real nature that actually boosts the tuned stat', () => {
    for (const stat of STATS) {
      const nature = natureForStatWheel(NEUTRAL_NATURE, stat, 2);
      expect(nature).not.toBe(NEUTRAL_NATURE);                // a real, applied nature
      expect(getNatureStats(nature).boostedStat).toBe(stat);  // and it boosts the right stat
    }
  });

  it('hinder (target 0) is a real nature that hinders the tuned stat', () => {
    for (const stat of STATS) {
      const nature = natureForStatWheel(NEUTRAL_NATURE, stat, 0);
      expect(nature).not.toBe(NEUTRAL_NATURE);
      expect(getNatureStats(nature).hinderedStat).toBe(stat);
    }
  });

  it('neutral (target 1) is the neutral nature', () => {
    expect(natureForStatWheel('Modest (+SPA, -ATK)', 'spa', 1)).toBe(NEUTRAL_NATURE);
  });

  it('falls back to the conventional dump stat when there is no half to keep', () => {
    expect(natureForStatWheel(NEUTRAL_NATURE, 'spa', 2)).toMatch(/^Modest/);  // +SpA -Atk
    expect(natureForStatWheel(NEUTRAL_NATURE, 'atk', 2)).toMatch(/^Adamant/); // +Atk -SpA
    expect(natureForStatWheel(NEUTRAL_NATURE, 'def', 2)).toMatch(/^Bold/);    // +Def -Atk
    expect(natureForStatWheel(NEUTRAL_NATURE, 'spd', 2)).toMatch(/^Calm/);    // +SpD -Atk
  });

  it('keeps an existing opposite half instead of resetting it', () => {
    // Adamant already dumps SpA; tuning Def should keep that, not switch the dump to Atk.
    expect(natureForStatWheel('Adamant (+ATK, -SPA)', 'def', 2)).toMatch(/^Impish/); // +Def -SpA
    // and hindering Spe from Adamant keeps the Atk boost
    expect(natureForStatWheel('Adamant (+ATK, -SPA)', 'spe', 0)).toMatch(/^Brave/);  // +Atk -Spe
  });
});

describe('natureWheelIndex', () => {
  it('round-trips with natureForStatWheel for every position', () => {
    for (const stat of STATS) {
      for (const target of [0, 1, 2]) {
        const nature = natureForStatWheel(NEUTRAL_NATURE, stat, target);
        expect(natureWheelIndex(nature, stat)).toBe(target);
      }
    }
  });
});

describe('the two editing surfaces agree', () => {
  // The desktop +/- buttons go through toggleNature; the landscape wheel and the team
  // review card go through natureForStatWheel. The same intent must give the same nature,
  // or the build changes depending on which screen you edited it from.
  it('a + press matches moving the wheel to boost, from any starting nature', () => {
    for (const nature of NATURES) {
      for (const stat of STATS) {
        if (getNatureStats(nature).boostedStat === stat) continue; // + there means "clear"
        expect(toggleNature(nature, stat, '+')).toBe(natureForStatWheel(nature, stat, 2));
      }
    }
  });

  it('a - press matches moving the wheel to hinder, from any starting nature', () => {
    for (const nature of NATURES) {
      for (const stat of STATS) {
        if (getNatureStats(nature).hinderedStat === stat) continue; // - there means "clear"
        expect(toggleNature(nature, stat, '-')).toBe(natureForStatWheel(nature, stat, 0));
      }
    }
  });

  it('pressing the stat that is already set clears to neutral on both surfaces', () => {
    for (const nature of NATURES) {
      const { boostedStat, hinderedStat } = getNatureStats(nature);
      if (boostedStat) expect(toggleNature(nature, boostedStat, '+')).toBe(NEUTRAL_NATURE);
      if (hinderedStat) expect(toggleNature(nature, hinderedStat, '-')).toBe(NEUTRAL_NATURE);
    }
  });

  it('every reachable result is a real nature, never a half-set one', () => {
    for (const nature of NATURES) {
      for (const stat of [...STATS, 'hp']) {
        for (const mod of ['+', '-'] as const) {
          const next = toggleNature(nature, stat, mod);
          expect(NATURES).toContain(next);
          const { boostedStat, hinderedStat } = getNatureStats(next);
          expect(Boolean(boostedStat)).toBe(Boolean(hinderedStat));
        }
      }
    }
  });
});
