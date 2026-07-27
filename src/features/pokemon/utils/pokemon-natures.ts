export const NATURES = [
  "Hardy",
  "Lonely (+ATK, -DEF)",
  "Adamant (+ATK, -SPA)",
  "Naughty (+ATK, -SPD)",
  "Brave (+ATK, -SPE)",
  "Bold (+DEF, -ATK)",
  "Docile",
  "Impish (+DEF, -SPA)",
  "Lax (+DEF, -SPD)",
  "Relaxed (+DEF, -SPE)",
  "Modest (+SPA, -ATK)",
  "Mild (+SPA, -DEF)",
  "Bashful",
  "Rash (+SPA, -SPD)",
  "Quiet (+SPA, -SPE)",
  "Calm (+SPD, -ATK)",
  "Gentle (+SPD, -DEF)",
  "Careful (+SPD, -SPA)",
  "Quirky",
  "Sassy (+SPD, -SPE)",
  "Timid (+SPE, -ATK)",
  "Hasty (+SPE, -DEF)",
  "Jolly (+SPE, -SPA)",
  "Naive (+SPE, -SPD)",
  "Serious"
];

const NATURE_STATS_MAP: Record<string, { boosted: string; hindered: string }> = {
  Lonely: { boosted: "ATK", hindered: "DEF" },
  Adamant: { boosted: "ATK", hindered: "SPA" },
  Naughty: { boosted: "ATK", hindered: "SPD" },
  Brave: { boosted: "ATK", hindered: "SPE" },
  Bold: { boosted: "DEF", hindered: "ATK" },
  Impish: { boosted: "DEF", hindered: "SPA" },
  Lax: { boosted: "DEF", hindered: "SPD" },
  Relaxed: { boosted: "DEF", hindered: "SPE" },
  Modest: { boosted: "SPA", hindered: "ATK" },
  Mild: { boosted: "SPA", hindered: "DEF" },
  Rash: { boosted: "SPA", hindered: "SPD" },
  Quiet: { boosted: "SPA", hindered: "SPE" },
  Calm: { boosted: "SPD", hindered: "ATK" },
  Gentle: { boosted: "SPD", hindered: "DEF" },
  Careful: { boosted: "SPD", hindered: "SPA" },
  Sassy: { boosted: "SPD", hindered: "SPE" },
  Timid: { boosted: "SPE", hindered: "ATK" },
  Hasty: { boosted: "SPE", hindered: "DEF" },
  Jolly: { boosted: "SPE", hindered: "SPA" },
  Naive: { boosted: "SPE", hindered: "SPD" },
};

/** The neutral nature. Five names are neutral; this is the one we produce. */
export const NEUTRAL_NATURE = 'Hardy';

const BY_BARE_NAME = new Map(
  Object.entries(NATURE_STATS_MAP).map(([name, stats]) => [name.toLowerCase(), stats])
);

/**
 * The bare name, as @smogon/calc and Showdown spell it — `NATURES` carries a decorated
 * display form ("Adamant (+ATK, -SPA)").
 */
export const bareNature = (nature: string): string => nature.split(' (')[0].trim();

/** The stat conventionally dumped when tuning `stat` — Atk, or SpA when tuning Atk. */
const dumpStatFor = (stat: string): string => (stat === 'atk' ? 'spa' : 'atk');

/**
 * The multiplier a nature applies to one stat. The single source of truth: the stat
 * display and the damage engine both read this, so they cannot disagree.
 *
 * A nature is a boost+hinder PAIR. Anything that isn't a real nature — an empty string,
 * an unknown name, or one of the five neutral natures — is 1.0 across the board.
 */
export const natureMultiplier = (nature: string, stat: string): number => {
  const entry = BY_BARE_NAME.get(bareNature(nature).toLowerCase());
  if (!entry) return 1.0;
  const s = stat.toUpperCase();
  return entry.boosted === s ? 1.1 : entry.hindered === s ? 0.9 : 1.0;
};

export const getNatureStats = (nature: string): { boostedStat: string | null; hinderedStat: string | null } => {
  const entry = BY_BARE_NAME.get(bareNature(nature).toLowerCase());
  return entry
    ? { boostedStat: entry.boosted.toLowerCase(), hinderedStat: entry.hindered.toLowerCase() }
    : { boostedStat: null, hinderedStat: null };
};

export const getNatureFromStats = (boostedStat: string | null, hinderedStat: string | null): string => {
  if (!boostedStat || !hinderedStat || boostedStat === hinderedStat) return NEUTRAL_NATURE;
  
  const b = boostedStat.toUpperCase();
  const h = hinderedStat.toUpperCase();

  for (const [nature, stats] of Object.entries(NATURE_STATS_MAP)) {
    if (stats.boosted === b && stats.hindered === h) {
      return NATURES.find(n => n.toLowerCase().startsWith(nature.toLowerCase())) || nature;
    }
  }
  
  return NEUTRAL_NATURE;
};

/**
 * Nature naming the result of putting `stat` at a wheel position: 0 = hinder, 1 = neutral,
 * 2 = boost.
 *
 * A nature is a boost+hinder PAIR, so setting one half needs the other. An existing opposite
 * half is kept — tuning Def while SpA is already dumped gives Impish, not Bold — and only when
 * there is none do we fall back to the conventional dump stat.
 */
export const natureForStatWheel = (nature: string, stat: string, target: number): string => {
  if (target === 1) return NEUTRAL_NATURE;
  const { boostedStat: boost, hinderedStat: hinder } = getNatureStats(nature);
  const partner = dumpStatFor(stat);
  return target === 2
    ? getNatureFromStats(stat, hinder && hinder !== stat ? hinder : partner)
    : getNatureFromStats(boost && boost !== stat ? boost : partner, stat);
};

/** Where `stat` currently sits on that wheel: 0 = hindered, 1 = neutral, 2 = boosted. */
export const natureWheelIndex = (nature: string, stat: string): number => {
  const m = natureMultiplier(nature, stat);
  return m > 1 ? 2 : m < 1 ? 0 : 1;
};

/**
 * Apply one `+`/`-` press. Pressing the stat that is already set returns to neutral;
 * otherwise this is the wheel move to that position, so both editing surfaces agree.
 */
export const toggleNature = (nature: string, stat: string, mod: '+' | '-'): string => {
  const { boostedStat: boost, hinderedStat: hinder } = getNatureStats(nature);
  if (mod === '+') return boost === stat ? NEUTRAL_NATURE : natureForStatWheel(nature, stat, 2);
  return hinder === stat ? NEUTRAL_NATURE : natureForStatWheel(nature, stat, 0);
};

/** Single-letter stat labels used across the Arena cards (H/A/B/C/D/S). */
export const STAT_SHORT: Record<string, string> = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };

/**
 * Compact arrow form for a card, e.g. "↑C ↓A". Neutral natures have no pair to point at,
 * so they show their name instead.
 */
export const natureArrows = (nature: string): string => {
  const { boostedStat: up, hinderedStat: down } = getNatureStats(nature);
  if (!up || !down) return getFormattedNature(nature);
  return `↑${STAT_SHORT[up] ?? up} ↓${STAT_SHORT[down] ?? down}`;
};

export const getFormattedNature = (nature: string): string => {
  if (!nature) return NEUTRAL_NATURE;
  const base = bareNature(nature);
  return NATURES.find(n => n.toLowerCase().startsWith(base.toLowerCase())) || base;
};
