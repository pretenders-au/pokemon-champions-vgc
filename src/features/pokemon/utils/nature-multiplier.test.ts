import { describe, it, expect } from 'vitest';
import { natureMultiplier, bareNature, NATURES, getNatureStats } from './pokemon-natures';

describe('natureMultiplier', () => {
  it('boosts and hinders the pair the nature names', () => {
    expect(natureMultiplier('Adamant (+ATK, -SPA)', 'atk')).toBe(1.1);
    expect(natureMultiplier('Adamant (+ATK, -SPA)', 'spa')).toBe(0.9);
    expect(natureMultiplier('Adamant (+ATK, -SPA)', 'def')).toBe(1.0);
  });

  it('accepts the bare name as well as the decorated one', () => {
    expect(natureMultiplier('Adamant', 'atk')).toBe(1.1);
    expect(natureMultiplier('Timid', 'spe')).toBe(1.1);
  });

  it('never touches HP', () => {
    for (const n of NATURES) expect(natureMultiplier(n, 'hp')).toBe(1.0);
  });

  it('is neutral for all five neutral natures', () => {
    for (const n of ['Hardy', 'Docile', 'Bashful', 'Quirky', 'Serious']) {
      for (const s of ['atk', 'def', 'spa', 'spd', 'spe']) {
        expect(natureMultiplier(n, s)).toBe(1.0);
      }
    }
  });

  it('is neutral for an unknown or empty nature rather than throwing', () => {
    expect(natureMultiplier('', 'atk')).toBe(1.0);
    expect(natureMultiplier('Nonsense', 'atk')).toBe(1.0);
  });

  it('gives exactly one boosted and one hindered stat for every non-neutral nature', () => {
    const NEUTRAL = ['Hardy', 'Docile', 'Bashful', 'Quirky', 'Serious'];
    const stats = ['atk', 'def', 'spa', 'spd', 'spe'];
    for (const n of NATURES) {
      const mults = stats.map((s) => natureMultiplier(n, s));
      const boosted = mults.filter((m) => m > 1).length;
      const hindered = mults.filter((m) => m < 1).length;
      const expected = NEUTRAL.includes(bareNature(n)) ? 0 : 1;
      expect({ nature: n, boosted, hindered }).toEqual({ nature: n, boosted: expected, hindered: expected });
    }
  });

  it('agrees with getNatureStats for every nature', () => {
    for (const n of NATURES) {
      const { boostedStat, hinderedStat } = getNatureStats(n);
      for (const s of ['atk', 'def', 'spa', 'spd', 'spe']) {
        const expected = s === boostedStat ? 1.1 : s === hinderedStat ? 0.9 : 1.0;
        expect(natureMultiplier(n, s)).toBe(expected);
      }
    }
  });
});

describe('bareNature', () => {
  it('strips the decoration @smogon/calc does not understand', () => {
    expect(bareNature('Adamant (+ATK, -SPA)')).toBe('Adamant');
    expect(bareNature('Hardy')).toBe('Hardy');
  });

  it('yields a name @smogon/calc accepts for every nature we offer', () => {
    // The engine's own table is bare-named; a decorated string reaches it as an unknown
    // nature and is silently treated as neutral.
    for (const n of NATURES) expect(bareNature(n)).not.toContain('(');
  });
});
