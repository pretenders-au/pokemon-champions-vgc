import { useCallback } from 'react';
import { getNatureStats, getNatureFromStats, toggleNature } from '@/features/pokemon/utils/pokemon-natures';

export interface StatState {
  boostedStat: string | null;
  hinderedStat: string | null;
  nature: string;
}

export const useStatEngine = () => {
  const calculateNatureToggle = (
    currentBoosted: string | null,
    currentHindered: string | null,
    stat: string,
    mod: '+' | '-'
  ): StatState => {
    const nature = toggleNature(getNatureFromStats(currentBoosted, currentHindered), stat, mod);
    const { boostedStat, hinderedStat } = getNatureStats(nature);
    return { boostedStat, hinderedStat, nature };
  };

  const getStatsForNature = (natureName: string): StatState => {
    const stats = getNatureStats(natureName);
    return {
      boostedStat: stats.boostedStat,
      hinderedStat: stats.hinderedStat,
      nature: natureName
    };
  };

  return {
    calculateNatureToggle,
    getStatsForNature
  };
};
