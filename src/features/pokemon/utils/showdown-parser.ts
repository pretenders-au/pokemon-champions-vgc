import { convertEvToSp, SP_TOTAL } from '@/features/pokemon/utils/sp-ev-converter';

export interface ParsedShowdownSet {
  species: string;
  item: string | null;
  ability: string | null;
  nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  moves: string[];
}

export const parseShowdownSet = (exportText: string): ParsedShowdownSet | null => {
  const lines = exportText.trim().split('\n').map(line => line.trim());
  if (lines.length === 0) return null;

  // Find the first non-empty line to start parsing the first set
  let startIndex = 0;
  while (startIndex < lines.length && lines[startIndex] === '') {
    startIndex++;
  }
  if (startIndex >= lines.length) return null;

  const firstLine = lines[startIndex];
  const itemMatch = firstLine.match(/@\s+(.+)$/);
  const item = itemMatch ? itemMatch[1].trim() : null;

  let speciesInfo = itemMatch ? firstLine.replace(/@\s+.+$/, '').trim() : firstLine;
  
  // Remove gender
  speciesInfo = speciesInfo.replace(/\s+\((M|F)\)$/i, '').trim();

  let species = speciesInfo;
  const nicknameMatch = speciesInfo.match(/^(.*)\s+\((.+)\)$/);
  if (nicknameMatch) {
    species = nicknameMatch[2].trim();
  }

  if (!species) return null;

  const parsed: ParsedShowdownSet = {
    species,
    item,
    ability: null,
    nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: []
  };

  const statMap: Record<string, keyof typeof parsed.evs> = {
    'HP': 'hp',
    'Atk': 'atk',
    'Def': 'def',
    'SpA': 'spa',
    'SpD': 'spd',
    'Spe': 'spe'
  };

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // If we hit an empty line, assume it's the end of the first set
    if (line === '') {
      break;
    }

    if (line.startsWith('Ability:')) {
      parsed.ability = line.replace('Ability:', '').trim();
      continue;
    }

    if (line.startsWith('EVs:') || line.startsWith('SPs:')) {
      const isSpPrefix = line.startsWith('SPs:');
      const statsStr = line.replace(/^(EVs|SPs):/, '').trim();
      const statParts = statsStr.split('/').map(s => s.trim());
      
      const tempVals: Record<string, number> = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      let maxValue = 0;
      let totalValue = 0;
      
      for (const part of statParts) {
        const [valStr, statName] = part.split(' ');
        if (valStr && statName && statMap[statName]) {
          const val = parseInt(valStr, 10);
          if (!isNaN(val)) {
            tempVals[statMap[statName]] = val;
            if (val > maxValue) maxValue = val;
            totalValue += val;
          }
        }
      }

      // An explicit "SPs:" prefix declares the units, so honor it directly.
      // Showdown always labels the line "EVs:" even when the numbers are SP, so
      // the "EVs:" prefix is ambiguous — fall back to the numeric heuristic there:
      // if all values are <= 32 and total is <= 66, assume they are already SP
      // (standard Showdown EVs go up to 252; a 32 could be 32 EVs or 32 SP).
      const isAlreadySP = isSpPrefix || (maxValue <= 32 && totalValue <= SP_TOTAL);

      for (const key of Object.keys(tempVals) as Array<keyof typeof parsed.evs>) {
        if (isAlreadySP) {
          parsed.evs[key] = tempVals[key];
        } else {
          parsed.evs[key] = convertEvToSp(tempVals[key]);
        }
      }
      continue;
    }

    if (line.startsWith('IVs:')) {
      // Ignore IVs in the string and always use 31 as requested
      continue;
    }

    if (line.endsWith(' Nature')) {
      parsed.nature = line.replace(' Nature', '').trim();
      continue;
    }

    if (line.startsWith('- ')) {
      if (parsed.moves.length < 4) {
        let moveName = line.replace(/^- /, '').trim();
        parsed.moves.push(moveName);
      }
      continue;
    }
  }

  return parsed;
};

export const parseShowdownTeam = (exportText: string): ParsedShowdownSet[] => {
  // Split by one or more empty lines
  const blocks = exportText.split(/\n\s*\n/);
  const sets: ParsedShowdownSet[] = [];
  
  for (const block of blocks) {
    const parsed = parseShowdownSet(block);
    if (parsed) {
      sets.push(parsed);
    }
  }
  
  return sets;
};
