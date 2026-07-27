import type { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import { matchSpecies, matchAbility, matchItem, matchMove, type MatchResult } from '@/features/pokemon/utils/showdown-matcher';
import { getNatureStats, getFormattedNature } from '@/features/pokemon/utils/pokemon-natures';

/**
 * Set resolution — match a parsed Showdown set against the dex.
 *
 * An unrecognised species is fatal for that set (`ok: false`). An unrecognised ability,
 * item or move is not: the field is left empty and the failure is reported. Nothing here
 * alerts, aborts a batch, or touches `window` — whether an error stops an import is the
 * caller's policy.
 *
 * See CONTEXT.md ("Set resolution") and docs/adr/0001 (species matching has no loose fallback).
 */

export interface AbilityRow {
  nameEn: string;
  nameZh: string | null;
}

export type ResolutionErrorKind = 'species' | 'ability' | 'item' | 'move';

export interface ResolutionError {
  kind: ResolutionErrorKind;
  /** The unmatched text, as it appeared in the set. */
  value: string;
}

/** Display label per failure kind, so callers can phrase their own message. */
export const KIND_LABEL: Record<ResolutionErrorKind, string> = {
  species: 'Pokémon',
  ability: 'Ability',
  item: 'Item',
  move: 'Move',
};

export interface Dex {
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  /** Bilingual ability rows for a species, ordered by slot. See `appDex`. */
  getAbilities: (pokemonId: number) => Promise<AbilityRow[]>;
}

export interface Resolved {
  pokemon: PokemonBaseStats;
  abilityNames: string[];
  activeAbility: string | null;
  item: string | null;
  /** Always four slots. */
  movesData: (MoveData | null)[];
  natureStats: { boostedStat: string | null; hinderedStat: string | null };
}

/**
 * `ok: false` means the species did not match. Discriminated so callers narrow to a
 * non-null `resolved` without an assertion.
 */
export type Resolution =
  | { ok: true; resolved: Resolved; corrections: string[]; errors: ResolutionError[] }
  | { ok: false; resolved: null; corrections: string[]; errors: ResolutionError[] };

/**
 * `null` ability rows mean "the ability list was not available" — `set.ability` is carried
 * through unvalidated. An empty array means "this species genuinely has no abilities", and
 * a stated ability is reported as an error. Only the synchronous render-time caller passes
 * null; see CONTEXT.md ("Set resolution").
 */
function resolveMatched(
  set: ParsedShowdownSet,
  speciesMatch: MatchResult<PokemonBaseStats> | null,
  moveList: MoveData[],
  abilityRows: AbilityRow[] | null
): Resolution {
  const corrections: string[] = [];
  const errors: ResolutionError[] = [];

  if (!speciesMatch) {
    errors.push({ kind: 'species', value: set.species });
    return { ok: false, resolved: null, corrections, errors };
  }
  const pokemon = speciesMatch.match;
  if (speciesMatch.isFuzzy) {
    corrections.push(`Pokémon: ${speciesMatch.originalQuery} ➔ ${speciesMatch.resolvedName}`);
  }

  const abilityNames = abilityRows
    ? abilityRows.map((a) => a.nameEn).filter((n): n is string => !!n)
    : set.ability ? [set.ability] : [];
  let activeAbility: string | null = abilityRows ? (abilityRows[0]?.nameEn ?? null) : (set.ability ?? null);

  if (abilityRows && set.ability) {
    const candidates = abilityRows.flatMap((a) => [a.nameEn, a.nameZh].filter((n): n is string => !!n));
    const resolvedAbility = matchAbility(set.ability, candidates);
    if (!resolvedAbility) {
      errors.push({ kind: 'ability', value: set.ability });
    } else {
      const row = abilityRows.find((r) => r.nameEn === resolvedAbility.match || r.nameZh === resolvedAbility.match);
      if (row?.nameEn) {
        activeAbility = row.nameEn;
        if (resolvedAbility.isFuzzy || resolvedAbility.match === row.nameZh) {
          corrections.push(`Ability: ${resolvedAbility.originalQuery} ➔ ${row.nameEn}`);
        }
      }
    }
  }

  let item = set.item;
  if (set.item) {
    const resolvedItem = matchItem(set.item);
    if (!resolvedItem) {
      errors.push({ kind: 'item', value: set.item });
    } else {
      item = resolvedItem.match;
      if (resolvedItem.isFuzzy || resolvedItem.originalQuery !== resolvedItem.resolvedName) {
        corrections.push(`Item: ${resolvedItem.originalQuery} ➔ ${resolvedItem.resolvedName}`);
      }
    }
  }

  const movesData: (MoveData | null)[] = [];
  for (const name of set.moves) {
    const move = matchMove(name, moveList);
    if (!move) {
      errors.push({ kind: 'move', value: name });
      movesData.push(null);
      continue;
    }
    if (move.isFuzzy || move.originalQuery !== move.resolvedName) {
      corrections.push(`Move: ${move.originalQuery} ➔ ${move.resolvedName}`);
    }
    movesData.push(move.match as MoveData);
  }
  while (movesData.length < 4) movesData.push(null);

  return {
    ok: true,
    resolved: {
      pokemon,
      abilityNames,
      activeAbility,
      item,
      movesData: movesData.slice(0, 4),
      natureStats: getNatureStats(set.nature),
    },
    corrections,
    errors,
  };
}

/** Pure, synchronous core. Pass `null` ability rows when no list is available. */
export function resolveSetWith(
  set: ParsedShowdownSet,
  pokemonList: PokemonBaseStats[],
  moveList: MoveData[],
  abilityRows: AbilityRow[] | null
): Resolution {
  return resolveMatched(
    set,
    matchSpecies(set.species, pokemonList) as MatchResult<PokemonBaseStats> | null,
    moveList,
    abilityRows
  );
}

/** Resolve one set, fetching the species' ability list. */
export async function resolveSet(set: ParsedShowdownSet, dex: Dex): Promise<Resolution> {
  const speciesMatch = matchSpecies(set.species, dex.pokemonList) as MatchResult<PokemonBaseStats> | null;
  // A failed lookup yields [] rather than null: a stated ability is then reported as
  // unrecognised, which is what the pre-module encoders did on a db error.
  const abilityRows = speciesMatch ? await dex.getAbilities(speciesMatch.match.id).catch(() => []) : [];
  return resolveMatched(set, speciesMatch, dex.moveList, abilityRows);
}

/** Assemble a Pokémon config from a set and its resolution. */
export function toConfig(set: ParsedShowdownSet, resolved: Resolved): PokemonConfig {
  const { pokemon: p, natureStats } = resolved;
  return {
    selectedId: p.id,
    type1: p.type1,
    type2: p.type2,
    baseHp: p.baseHp,
    baseAtk: p.baseAttack,
    baseDef: p.baseDefense,
    baseSpa: p.baseSpAtk,
    baseSpd: p.baseSpDef,
    baseSpe: p.baseSpeed,
    spHp: set.evs.hp,
    spAtk: set.evs.atk,
    spDef: set.evs.def,
    spSpa: set.evs.spa,
    spSpd: set.evs.spd,
    spSpe: set.evs.spe,
    nature: getFormattedNature(set.nature),
    boostedStat: natureStats.boostedStat,
    hinderedStat: natureStats.hinderedStat,
    moves: resolved.movesData,
    activeMoveIndex: 0,
    abilities: resolved.abilityNames,
    activeAbility: resolved.activeAbility,
    item: resolved.item,
    hpPercent: 100,
    isTypeOverridden: false,
  };
}

export interface SetsResolution {
  members: PokemonConfig[];
  corrections: string[];
  errors: ResolutionError[];
}

/**
 * Resolve many sets, always collecting. Sets whose species did not match are omitted from
 * `members`; their errors are still reported. Callers that want to abort check `errors`.
 */
export async function resolveSets(sets: ParsedShowdownSet[], dex: Dex): Promise<SetsResolution> {
  const members: PokemonConfig[] = [];
  const corrections: string[] = [];
  const errors: ResolutionError[] = [];

  for (const set of sets) {
    const result = await resolveSet(set, dex);
    corrections.push(...result.corrections);
    errors.push(...result.errors);
    if (result.ok) members.push(toConfig(set, result.resolved));
  }

  return { members, corrections, errors };
}
