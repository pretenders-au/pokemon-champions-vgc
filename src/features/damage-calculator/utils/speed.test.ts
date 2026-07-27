import { describe, it, expect } from 'vitest';
import { effectiveSpeed, buildSpeedCompare } from './speed';

describe('effectiveSpeed', () => {
  it('identity with no modifiers', () => expect(effectiveSpeed(205)).toBe(205));
  it('scarf = floor(x1.5)', () => expect(effectiveSpeed(205, { scarf: true })).toBe(307));
  it('tailwind = floor(x2)', () => expect(effectiveSpeed(205, { tailwind: true })).toBe(410));
  it('stacks with floors: scarf then tailwind', () =>
    expect(effectiveSpeed(205, { scarf: true, tailwind: true })).toBe(614));
});

describe('buildSpeedCompare', () => {
  // You: Flutter Mane, base 135 Spe, 32 SP, +Spe nature → floor((135+20+32)*1.1) = 205
  const you = { baseSpe: 135, spSpe: 32, nature: 'Timid (+SPE, -ATK)', speStage: 0, item: null, isTailwind: false };
  // Opp: Dragapult, base 142 → tiers: Max+ 213, Max 194, Uninvested 162
  const opp = { baseSpe: 142, speStage: 0, isTailwind: false };

  it('computes your actual / scarf / tailwind speeds', () => {
    const c = buildSpeedCompare(you, opp);
    expect(c.yours).toEqual({ actual: 205, scarf: 307, tailwind: 410 });
  });

  it('actual honors a held Choice Scarf', () => {
    const c = buildSpeedCompare({ ...you, item: 'Choice Scarf' }, opp);
    expect(c.yours.actual).toBe(307);
  });

  it('builds five opponent tiers with outcomes vs your actual', () => {
    const c = buildSpeedCompare(you, opp);
    expect(c.tiers.map((t) => t.label)).toEqual(['Max+ scarf', 'Max scarf', 'Max+', 'Max', 'Uninvested']);
    expect(c.tiers.map((t) => t.value)).toEqual([319, 291, 213, 194, 162]);
    expect(c.tiers.map((t) => t.outcome)).toEqual(['outsped', 'outsped', 'outsped', 'faster', 'faster']);
  });

  it('ties are reported', () => {
    // Opp base 135 with same max+ math: 205 vs 205
    const c = buildSpeedCompare(you, { baseSpe: 135, speStage: 0, isTailwind: false });
    expect(c.tiers.find((t) => t.label === 'Max+')!.outcome).toBe('tie');
  });

  it('applies opponent rank stages and tailwind to tiers', () => {
    const c = buildSpeedCompare(you, { baseSpe: 142, speStage: 1, isTailwind: true });
    // Max+ 213 → +1 stage floor(213*1.5)=319 → tailwind 638
    expect(c.tiers.find((t) => t.label === 'Max+')!.value).toBe(638);
    expect(c.tiers.find((t) => t.label === 'Max+')!.outcome).toBe('outsped');
  });
});
