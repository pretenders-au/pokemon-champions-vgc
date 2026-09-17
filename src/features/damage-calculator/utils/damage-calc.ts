// @smogon/calc is a vendored build of smogon/damage-calc master (vendor/smogon-calc). It models
// the Champions-original Mega abilities natively, so nothing below special-cases them.
// See docs/champions-new-abilities.md.
import { calculate, Pokemon, Move, Field, Generations, Result, toID } from '@smogon/calc';
import { bareNature } from '@/features/pokemon/utils/pokemon-natures';
import { championsHP, championsStat } from '@/features/pokemon/utils/champions-stats';

/**
 * Pokémon Champions Stat and Damage Formulas (Level 50 VGC)
 */

export const calculateHP = (base: number, sp: number): number => {
  return championsHP(base, sp);
};

export const calculateStat = (
  base: number, 
  sp: number, 
  nature: number, 
  stage: number = 0,
  abilityMultiplier: number = 1.0
): number => {
  const raw = championsStat(base, sp, nature);
  const withStage = Math.floor(raw * getStageMultiplier(stage));
  return Math.floor(withStage * abilityMultiplier);
};

export const getStatModifier = (
  ability: string | null,
  statKey: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe',
  role: 'attacker' | 'defender',
  pokemonTypes: string[] = [],
  weather: string = 'None',
  hpPercent: number = 100
): { modifier: number; triggered: boolean } => {
  let modifier = 1.0;
  let triggered = false;

  // Gen 9 Weather Stat Buffs
  if (role === 'defender') {
    if (weather === 'Sandstorm' && pokemonTypes.includes('rock') && statKey === 'spd') {
      modifier *= 1.5;
    }
    if (weather === 'Snow' && pokemonTypes.includes('ice') && statKey === 'def') {
      modifier *= 1.5;
    }
  }

  if (!ability) return { modifier, triggered };
  const name = ability.toLowerCase();

  // HP-based Stat Penalties
  if (role === 'attacker' && name === 'defeatist' && hpPercent <= 50) {
    if (statKey === 'atk' || statKey === 'spa') {
      modifier *= 0.5;
      triggered = true;
    }
  }

  switch (name) {
    case 'huge power':
    case 'pure power':
      if (role === 'attacker' && statKey === 'atk') modifier *= 2.0;
      break;
    case 'fur coat':
      if (role === 'defender' && statKey === 'def') modifier *= 2.0;
      break;
    case 'guts':
      if (role === 'attacker' && statKey === 'atk') modifier *= 1.5;
      break;
  }

  return { modifier, triggered };
};

export const normalizeSmogonName = (name: string): string => {
  if (!name) return name;

  const fallbacks: Record<string, string> = {
    'Urshifu (Single Strike)': 'Urshifu',
    'Urshifu (Rapid Strike)': 'Urshifu-Rapid-Strike',
    'Urshifu (Single Strike Gmax)': 'Urshifu-Gmax',
    'Urshifu (Rapid Strike Gmax)': 'Urshifu-Rapid-Strike-Gmax',
    'Ogerpon (Teal Mask)': 'Ogerpon',
    'Ogerpon (Wellspring Mask)': 'Ogerpon-Wellspring',
    'Ogerpon (Hearthflame Mask)': 'Ogerpon-Hearthflame',
    'Ogerpon (Cornerstone Mask)': 'Ogerpon-Cornerstone',
    'Calyrex (Ice Rider)': 'Calyrex-Ice',
    'Calyrex (Shadow Rider)': 'Calyrex-Shadow',
    'Necrozma (Dusk Mane)': 'Necrozma-Dusk-Mane',
    'Necrozma (Dawn Wings)': 'Necrozma-Dawn-Wings',
    'Necrozma (Ultra)': 'Necrozma-Ultra',
    'Zygarde (10% Forme)': 'Zygarde-10%',
    'Zygarde (Complete Forme)': 'Zygarde-Complete',
    'Kyurem (Black)': 'Kyurem-Black',
    'Kyurem (White)': 'Kyurem-White',
    'Terapagos (Terastal Form)': 'Terapagos-Terastal',
    'Terapagos (Stellar Form)': 'Terapagos-Stellar',
    'Zacian (Crowned Sword)': 'Zacian-Crowned',
    'Zamazenta (Crowned Shield)': 'Zamazenta-Crowned',
    'Palafin (Hero Form)': 'Palafin-Hero',
    'Mega Charizard X': 'Charizard-Mega-X',
    'Mega Charizard Y': 'Charizard-Mega-Y',
    'Mega Mewtwo X': 'Mewtwo-Mega-X',
    'Mega Mewtwo Y': 'Mewtwo-Mega-Y',
    'Aegislash (Shield)': 'Aegislash-Shield',
    'Aegislash (Blade)': 'Aegislash-Blade',
  };

  if (fallbacks[name]) {
    return fallbacks[name];
  }

  let normalized = name;

  normalized = normalized.replace(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/, (match, region, pokemon) => {
    const regionMap: Record<string, string> = {
      'Alolan': 'Alola',
      'Galarian': 'Galar',
      'Hisuian': 'Hisui',
      'Paldean': 'Paldea'
    };
    return `${pokemon}-${regionMap[region]}`;
  });

  normalized = normalized.replace(/^Mega\s+(.+)$/, '$1-Mega');

  // Every gendered dex row carries a "(Male)"/"(Female)" suffix. Smogon names the
  // male form bare and gives a distinct -F species only where the female differs
  // mechanically; Frillish/Jellicent/Pyroar females are cosmetic, so both map bare.
  const femaleIsDistinct = ['Basculegion', 'Meowstic', 'Indeedee', 'Oinkologne'];
  const gendered = normalized.match(/^(.+) \((Male|Female)\)$/);
  if (gendered) {
    const [, species, gender] = gendered;
    return gender === 'Female' && femaleIsDistinct.includes(species) ? `${species}-F` : species;
  }

  return normalized;
};

export const mapToSmogonPokemon = (
  stateSide: any, 
  pokemonName: string,
  baseType1: string,
  baseType2?: string | null
): Pokemon => {
  const gen = Generations.get(9);
  
  // Champions correctness: SP is encoded into the base stat below (base + SP),
  // so EVs are zeroed. @smogon/calc then computes (base + SP + 20) * nature at
  // Lv50/IV31 — the exact Champions stat — and this survives the clone() inside
  // calculate(), which rebuilds stats from evs + species.baseStats (not rawStats).
  const evs = {
    hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0,
  };

  const currentHp = Math.floor(calculateHP(stateSide.baseHp, stateSide.spHp) * (stateSide.hpPercent / 100));

  const boosts = {
    atk: stateSide.stages.atk || 0,
    def: stateSide.stages.def || 0,
    spa: stateSide.stages.spa || 0,
    spd: stateSide.stages.spd || 0,
    spe: stateSide.stages.spe || 0,
  };

  const t1 = stateSide.isTypeOverridden ? stateSide.type1 : baseType1;
  const t2 = stateSide.isTypeOverridden ? stateSide.type2 : baseType2;

  const types = [t1, t2]
    .filter(Boolean)
    .filter(t => t!.toLowerCase() !== 'none')
    .map(t => t!.charAt(0).toUpperCase() + t!.slice(1).toLowerCase());

  // Use 'None' as species if overridden to prevent species-specific logic (like Garchomp's Ground immunity)
  // from interfering with our manual type selection.
  const effectiveName = stateSide.isTypeOverridden ? 'None' : normalizeSmogonName(pokemonName);

  const p = new Pokemon(gen, effectiveName, {
    level: 50,
    ability: stateSide.activeAbility || undefined,
    item: stateSide.item || undefined,
    nature: bareNature(stateSide.nature) as any,
    evs,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    boosts,
    curHP: currentHp,
    overrides: {
      types: types as any,
      weightkg: 100,
      baseStats: {
        hp: stateSide.baseHp + (stateSide.spHp || 0),
        atk: stateSide.baseAtk + (stateSide.spAtk || 0),
        def: stateSide.baseDef + (stateSide.spDef || 0),
        spa: stateSide.baseSpa + (stateSide.spSpa || 0),
        spd: stateSide.baseSpd + (stateSide.spSpd || 0),
        spe: stateSide.baseSpe + (stateSide.spSpe || 0),
      }
    }
  });

  // Deep override: ensure the instance and its species reference use the overridden types
  if (stateSide.isTypeOverridden) {
    p.types = types as unknown as typeof p.types;
    if (p.species) {
      // Nuclear option: Shadow the species object entirely and change ID to prevent cached lookups
      p.species = {
        ...p.species,
        id: 'custom' as any,
        types: types,
        name: pokemonName as any
      } as any;
    }
  }
  
  return p;
};

export const mapToSmogonField = (
  weather: string, 
  isSpreadTarget: boolean,
  isFairyAura: boolean = false,
  isDarkAura: boolean = false,
  isAuraBreak: boolean = false,
  terrain: string = 'None',
  isGravity: boolean = false,
  attackerSide: any = {},
  defenderSide: any = {}
): Field => {
  const weatherMap: Record<string, string> = {
    'Sun': 'Sun',
    'Rain': 'Rain',
    'Sandstorm': 'Sand',
    'Snow': 'Snow',
    'None': ''
  };

  return new Field({
    weather: weatherMap[weather] as any,
    gameType: isSpreadTarget ? 'Doubles' : 'Singles',
    isFairyAura,
    isDarkAura,
    isAuraBreak,
    terrain: terrain === 'None' ? undefined : terrain as any,
    isGravity,
    attackerSide: {
      isReflect: attackerSide.isReflect,
      isLightScreen: attackerSide.isLightScreen,
      isAuroraVeil: attackerSide.isAuroraVeil,
      isHelpingHand: attackerSide.isHelpingHand,
      isFriendGuard: attackerSide.isFriendGuard,
      isTailwind: attackerSide.isTailwind,
    },
    defenderSide: {
      isReflect: defenderSide.isReflect,
      isLightScreen: defenderSide.isLightScreen,
      isAuroraVeil: defenderSide.isAuroraVeil,
      isHelpingHand: defenderSide.isHelpingHand,
      isFriendGuard: defenderSide.isFriendGuard,
      isTailwind: defenderSide.isTailwind,
    }
  });
};

// Pokémon Champions rebalances some moves — First Impression is 100 BP, Slash 80, Snap Trap is
// Steel, … — and upstream records that in its Champions generation (gen 0). The engine runs the
// gen 9 mechanics, so borrow the Champions base power and type wherever they differ from gen 9.
// scripts/sync-champions-move-data.ts copies the same values into the dex so the picker agrees.
export const championsMoveOverrides = (moveName: string): { basePower?: number; type?: string } => {
  const id = toID(moveName);
  const champ = Generations.get(0).moves.get(id);
  const main = Generations.get(9).moves.get(id);
  if (!champ || !main) return {};
  const out: { basePower?: number; type?: string } = {};
  if (champ.basePower !== undefined && champ.basePower !== main.basePower) out.basePower = champ.basePower;
  if (champ.type && champ.type !== main.type) out.type = champ.type;
  return out;
};

export const mapToSmogonMove = (
  moveName: string,
  isCrit: boolean = false,
  hits?: number,
  customBp?: number
): Move => {
  const gen = Generations.get(9);
  const overrides: { basePower?: number; type?: string } = championsMoveOverrides(moveName);
  if (customBp !== undefined) overrides.basePower = customBp; // an explicit BP (Last Respects, …) wins
  const options: any = { isCrit, hits };
  if (Object.keys(overrides).length > 0) options.overrides = overrides;
  return new Move(gen, moveName, options);
};

export const getMovePowerModifier = (moveName: string, battleState: any): number | undefined => {
  if (moveName === 'Last Respects') {
    const faintedCount = battleState.faintedCount || 0;
    return 50 + (faintedCount * 50);
  }
  return undefined;
};

export const MULTIHIT_MOVES_DATA: Record<string, { min: number; max: number }> = {
  'Double Kick': { min: 2, max: 2 },
  'Twineedle': { min: 2, max: 2 },
  'Bonemerang': { min: 2, max: 2 },
  'Double Hit': { min: 2, max: 2 },
  'Dual Chop': { min: 2, max: 2 },
  'Gear Grind': { min: 2, max: 2 },
  'Double Iron Bash': { min: 2, max: 2 },
  'Dragon Darts': { min: 2, max: 2 },
  'Dual Wingbeat': { min: 2, max: 2 },
  'Twin Beam': { min: 2, max: 2 },
  'Tachyon Cutter': { min: 2, max: 2 },
  'Surging Strikes': { min: 3, max: 3 },
  'Triple Dive': { min: 3, max: 3 },
  'Triple Kick': { min: 1, max: 3 },
  'Triple Axel': { min: 1, max: 3 },
  'Double Slap': { min: 2, max: 5 },
  'Comet Punch': { min: 2, max: 5 },
  'Fury Attack': { min: 2, max: 5 },
  'Pin Missile': { min: 2, max: 5 },
  'Spike Cannon': { min: 2, max: 5 },
  'Barrage': { min: 2, max: 5 },
  'Fury Swipes': { min: 2, max: 5 },
  'Bone Rush': { min: 2, max: 5 },
  'Arm Thrust': { min: 2, max: 5 },
  'Bullet Seed': { min: 2, max: 5 },
  'Icicle Spear': { min: 2, max: 5 },
  'Rock Blast': { min: 2, max: 5 },
  'Tail Slap': { min: 2, max: 5 },
  'Water Shuriken': { min: 2, max: 5 },
  'Scale Shot': { min: 2, max: 5 },
  'Population Bomb': { min: 1, max: 10 },
};

export const isMultiHitMove = (moveName: string): boolean => {
  if (!moveName) return false;
  if (MULTIHIT_MOVES_DATA[moveName]) return true;

  try {
    const gen = Generations.get(9);
    const move = new Move(gen, moveName);
    return !!(move as any).multihit;
  } catch (e) {
    return false;
  }
};

export const getMultiHitLimits = (moveName: string): { min: number; max: number } => {
  if (MULTIHIT_MOVES_DATA[moveName]) {
    return MULTIHIT_MOVES_DATA[moveName];
  }

  try {
    const gen = Generations.get(9);
    const move = new Move(gen, moveName);
    const multihit = (move as any).multihit;
    if (Array.isArray(multihit)) {
      return { min: multihit[0], max: multihit[1] };
    } else if (typeof multihit === 'number') {
      return { min: multihit, max: multihit };
    }
  } catch (e) {}

  return { min: 2, max: 5 }; // Default fallback
};

export const getStageMultiplier = (stage: number): number => {
  if (stage > 0) return (2 + stage) / 2;
  if (stage < 0) return 2 / (2 + Math.abs(stage));
  return 1;
};

export interface DamageResult {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  moveName: string;
  moveNameZh: string | null;
  moveType: number;
  originalType: number;
  isStab: boolean;
  effectiveness: number;
  triggeredAbilities?: string[];
}

export const calculateSmogonDamage = (
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  field: Field
): Result => {
  const gen = Generations.get(9);
  return calculate(gen, attacker, defender, move, field);
};

/** Flatten @smogon/calc damage output (multi-hit = array of arrays summed) to [min..max]. */
export const flattenDamage = (arr: any[]): number[] => {
  if (arr.length === 0) return [0];
  if (Array.isArray(arr[0])) {
    const min = arr.reduce((acc, sub) => acc + (typeof sub[0] === 'number' ? sub[0] : 0), 0);
    const max = arr.reduce((acc, sub) => acc + (typeof sub[sub.length - 1] === 'number' ? sub[sub.length - 1] : 0), 0);
    return [min, max];
  }
  return arr.filter((d) => typeof d === 'number');
};
