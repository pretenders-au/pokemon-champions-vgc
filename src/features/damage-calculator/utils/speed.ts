import { natureMultiplier } from '@/features/pokemon/utils/pokemon-natures';
import { calculateStat, getStageMultiplier } from './damage-calc';
import { calculateSpeedStats } from '@/features/pokemon/utils/stats';
import type { SideState } from '@/features/damage-calculator/hooks/useCalculatorState';

/**
 * Speed comparison math for the landscape calculator's Speed mode.
 * Ability speed multipliers (Swift Swim etc.) are out of scope — matches the
 * speed-tiers feature, which also ignores them.
 */

export function effectiveSpeed(speed: number, opts: { scarf?: boolean; tailwind?: boolean } = {}): number {
  let s = speed;
  if (opts.scarf) s = Math.floor(s * 1.5);
  if (opts.tailwind) s = Math.floor(s * 2);
  return s;
}

/** Format a stat stage as +N / ±0 / -N. */
export function fmtStage(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

/** Live speed formula string shown under the speed comparison. */
export function speedFormula(s: SideState): string {
  const mult = natureMultiplier(s.nature, 'spe');
  const val = Math.floor((s.baseSpe + 20 + s.spSpe) * mult);
  return `${val} = floor((${s.baseSpe} + 20 + ${s.spSpe}) × ${mult.toFixed(1)})`;
}

export interface SpeedTierRow { label: string; value: number; outcome: 'faster' | 'tie' | 'outsped' }
export interface SpeedCompare { yours: { actual: number; scarf: number; tailwind: number }; tiers: SpeedTierRow[] }

export function buildSpeedCompare(
  you: { baseSpe: number; spSpe: number; nature: string; speStage: number; item: string | null; isTailwind: boolean },
  opp: { baseSpe: number; speStage: number; isTailwind: boolean },
): SpeedCompare {
  const clean = calculateStat(you.baseSpe, you.spSpe, natureMultiplier(you.nature, 'spe'), you.speStage);
  const scarfed = you.item === 'Choice Scarf';
  const actual = effectiveSpeed(clean, { scarf: scarfed, tailwind: you.isTailwind });
  const yours = {
    actual,
    scarf: effectiveSpeed(clean, { scarf: true, tailwind: you.isTailwind }),
    tailwind: effectiveSpeed(clean, { scarf: scarfed, tailwind: true }),
  };

  const t = calculateSpeedStats(opp.baseSpe);
  const withOppMods = (v: number, scarf: boolean) =>
    effectiveSpeed(Math.floor(v * getStageMultiplier(opp.speStage)), { scarf, tailwind: opp.isTailwind });

  const rows: [string, number][] = [
    ['Max+ scarf', withOppMods(t.maxPlus, true)],
    ['Max scarf', withOppMods(t.maxNeutral, true)],
    ['Max+', withOppMods(t.maxPlus, false)],
    ['Max', withOppMods(t.maxNeutral, false)],
    ['Uninvested', withOppMods(t.uninvested, false)],
  ];
  const tiers = rows.map(([label, value]) => ({
    label,
    value,
    outcome: actual > value ? ('faster' as const) : actual === value ? ('tie' as const) : ('outsped' as const),
  }));
  return { yours, tiers };
}
