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

/** The five stats a nature can modify. HP is never affected. */
export type NatureStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

const BY_BARE_NAME = new Map(
  Object.entries(NATURE_STATS_MAP).map(([name, stats]) => [name.toLowerCase(), stats])
);

/**
 * The bare name, as @smogon/calc and Showdown spell it — `NATURES` carries a decorated
 * display form ("Adamant (+ATK, -SPA)").
 */
export const bareNature = (nature: string | null | undefined): string =>
  (nature ?? '').split(' (')[0].trim();

/**
 * The multiplier a nature applies to one stat. The single source of truth: the stat
 * display and the damage engine both read this, so they cannot disagree.
 *
 * A nature is a boost+hinder PAIR. Anything that isn't a real nature — an empty string,
 * an unknown name, or one of the five neutral natures — is 1.0 across the board.
 */
export const natureMultiplier = (nature: string | null | undefined, stat: string): number => {
  const entry = BY_BARE_NAME.get(bareNature(nature).toLowerCase());
  if (!entry) return 1.0;
  const s = stat.toUpperCase();
  return entry.boosted === s ? 1.1 : entry.hindered === s ? 0.9 : 1.0;
};

export const getNatureStats = (nature: string): { boostedStat: string | null; hinderedStat: string | null } => {
  if (!nature) return { boostedStat: null, hinderedStat: null };
  const realNature = nature.split(' (')[0].trim().toLowerCase();
  
  const entry = Object.entries(NATURE_STATS_MAP).find(
    ([key]) => key.toLowerCase() === realNature
  );

  if (entry) {
    const stats = entry[1];
    return { boostedStat: stats.boosted.toLowerCase(), hinderedStat: stats.hindered.toLowerCase() };
  }
  return { boostedStat: null, hinderedStat: null };
};

export const getNatureFromStats = (boostedStat: string | null, hinderedStat: string | null): string => {
  if (!boostedStat || !hinderedStat || boostedStat === hinderedStat) return "Hardy";
  
  const b = boostedStat.toUpperCase();
  const h = hinderedStat.toUpperCase();

  for (const [nature, stats] of Object.entries(NATURE_STATS_MAP)) {
    if (stats.boosted === b && stats.hindered === h) {
      return NATURES.find(n => n.toLowerCase().startsWith(nature.toLowerCase())) || nature;
    }
  }
  
  return "Hardy";
};

/**
 * Nature name for a per-stat 3-way wheel: target 0 = hinder, 1 = neutral, 2 = boost.
 * A champions nature is a boost+hinder PAIR — a lone boost has no real nature and the
 * damage engine ignores it. Pair the tuned stat with the conventional dump stat
 * (Atk, or SpA when tuning Atk) so it maps to a real nature (↑SpA → Modest, ↑Def → Bold).
 */
export const natureForStatWheel = (stat: string, target: number): string => {
  const partner = stat === 'atk' ? 'spa' : 'atk';
  const boosted = target === 2 ? stat : target === 0 ? partner : null;
  const hindered = target === 2 ? partner : target === 0 ? stat : null;
  return getNatureFromStats(boosted, hindered);
};

/**
 * Apply one `+`/`-` press to a nature and return the nature that results.
 *
 * A nature is a boost+hinder PAIR, so a press that would leave only one half fills the
 * other with the conventional dump stat (Atk, or SpA when tuning Atk) — the same rule
 * `natureForStatWheel` uses. Pressing the stat that is already set returns to neutral.
 */
export const toggleNature = (nature: string, stat: string, mod: '+' | '-'): string => {
  const { boostedStat: boost, hinderedStat: hinder } = getNatureStats(nature);
  const partner = stat === 'atk' ? 'spa' : 'atk';

  if (mod === '+') {
    if (boost === stat) return 'Hardy';
    return getNatureFromStats(stat, hinder && hinder !== stat ? hinder : partner);
  }
  if (hinder === stat) return 'Hardy';
  return getNatureFromStats(boost && boost !== stat ? boost : partner, stat);
};

export const getFormattedNature = (nature: string): string => {
  if (!nature) return "Hardy";
  const baseName = nature.split(' (')[0].trim().toLowerCase();
  return NATURES.find(n => n.toLowerCase().startsWith(baseName)) || nature.split(' (')[0].trim();
};
