import { describe, it, expect } from 'vitest';
import { sideReducer, initialSide, type SideState, type SideAction } from './useCalculatorState';
import {
  pokemonReducer, initialPokemonState, AEGISLASH_ID,
  type PokemonConfig, type PokemonAction,
} from '@/features/pokemon/hooks/usePokemonEditor';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

/**
 * The calculator's `sideReducer` and the team editor's `pokemonReducer` both implement
 * every build edit — all 18 of pokemonReducer's cases also exist in sideReducer. Nothing
 * declares that they must agree, and they have drifted.
 *
 * This pins the invariant: given equivalent input, both must produce the same result on
 * the fields they share, i.e. the 24 in `PokemonConfig`. Battle-instance fields
 * (`stages`, `movesHits`, the screen flags, ...) exist only on `SideState` and are out of
 * scope by construction — that is the one legitimate difference between them.
 *
 * If the shared cases are ever extracted into a single build reducer, this stays green
 * for free; if that extraction changes behaviour, it goes red.
 *
 * One case is exempt from the table. `LOAD_CONFIG` takes genuinely different payloads —
 * the editor takes a whole PokemonConfig, the calculator takes config + pokemon +
 * abilities + movesData — so there is no equivalent input to feed both. It gets its own
 * tests below instead: the payloads differ, but the two must still agree about a missing
 * form. They deliberately still differ on `activeMoveIndex` and `hpPercent`, because
 * restoring a saved build should keep the HP and cursor it was saved with, unlike an
 * import that replaced every move.
 */

// The build half of SideState — exactly PokemonConfig's fields. Listed rather than derived
// so each field is a deliberate choice; the first test below is what actually holds the
// list honest, since this file is excluded from tsc and a typo here would silently drop a
// field from every comparison.
const BUILD_FIELDS = [
  'selectedId', 'type1', 'type2',
  'baseHp', 'baseAtk', 'baseDef', 'baseSpa', 'baseSpd', 'baseSpe',
  'spHp', 'spAtk', 'spDef', 'spSpa', 'spSpd', 'spSpe',
  'nature', 'moves', 'activeMoveIndex', 'abilities', 'activeAbility',
  'item', 'hpPercent', 'isTypeOverridden', 'form',
] as const;

const build = (s: SideState | PokemonConfig) =>
  Object.fromEntries(BUILD_FIELDS.map((k) => [k, (s as Record<string, unknown>)[k]]));

const mon = (over: Partial<PokemonBaseStats> = {}): PokemonBaseStats => ({
  id: 812, identifier: 'rillaboom', nameEn: 'Rillaboom', nameZh: null,
  type1: 'grass', type2: null,
  baseHp: 100, baseAttack: 125, baseDefense: 90, baseSpAtk: 60, baseSpDef: 70, baseSpeed: 85,
  ...over,
}) as PokemonBaseStats;

const aegislash = mon({ id: AEGISLASH_ID, identifier: 'aegislash', nameEn: 'Aegislash (Shield)', type1: 'steel', type2: 'ghost' });
const move = (nameEn: string): MoveData => ({ id: 1, nameEn, nameZh: null, power: 90, type: 'grass', damageClass: 'physical', accuracy: 100 }) as unknown as MoveData;

const preset = {
  pokemonName: 'Rillaboom', nature: 'Adamant', ability: 'Grassy Surge', item: 'Assault Vest',
  sp: { hp: 12, atk: 32, def: 4, spa: 0, spd: 8, spe: 10 }, moves: ['Grassy Glide'],
};
const showdownSet = {
  species: 'Rillaboom', nature: 'Adamant', ability: 'Grassy Surge', item: 'Assault Vest',
  evs: { hp: 12, atk: 32, def: 4, spa: 0, spd: 8, spe: 10 }, moves: ['Grassy Glide'],
};

// A start state that is NOT the default, so a case that forgets to reset a field is
// visibly different from one that resets it.
const START: PokemonConfig = {
  ...initialPokemonState,
  selectedId: 1, type1: 'fire', type2: 'dark',
  baseHp: 95, baseAtk: 115, baseDef: 90, baseSpa: 80, baseSpd: 90, baseSpe: 60,
  spHp: 20, spAtk: 28, spDef: 6, spSpa: 4, spSpd: 12, spSpe: 2,
  nature: 'Modest (+SPA, -ATK)',
  moves: [move('Fake Out'), move('Flare Blitz'), null, null],
  activeMoveIndex: 2,
  abilities: ['Blaze', 'Intimidate'], activeAbility: 'Intimidate',
  item: 'Sitrus Berry', hpPercent: 60, isTypeOverridden: true,
};
const startSide: SideState = { ...initialSide, ...START };

const abilities = ['Grassy Surge', 'Overgrow'];
const movesData = [move('Grassy Glide'), null, null, null];

/** Same intent, expressed in each reducer's own action shape. */
const CASES: Array<{ name: string; side: SideAction; config: PokemonAction }> = [
  { name: 'SET_SP', side: { type: 'SET_SP', payload: { side: 'p1', key: 'spAtk', val: 31 } }, config: { type: 'SET_SP', payload: { key: 'spAtk', val: 31 } } },
  { name: 'SET_SP clamps above 32', side: { type: 'SET_SP', payload: { side: 'p1', key: 'spAtk', val: 99 } }, config: { type: 'SET_SP', payload: { key: 'spAtk', val: 99 } } },
  { name: 'SET_NATURE', side: { type: 'SET_NATURE', payload: { side: 'p1', nature: 'Jolly (+SPE, -SPA)' } }, config: { type: 'SET_NATURE', payload: 'Jolly (+SPE, -SPA)' } },
  { name: 'TOGGLE_NATURE', side: { type: 'TOGGLE_NATURE', payload: { side: 'p1', stat: 'atk', mod: '+' } }, config: { type: 'TOGGLE_NATURE', payload: { stat: 'atk', mod: '+' } } },
  { name: 'SELECT_POKEMON', side: { type: 'SELECT_POKEMON', payload: { side: 'p1', pokemon: mon() } }, config: { type: 'SELECT_POKEMON', payload: { pokemon: mon() } } },
  { name: 'SELECT_POKEMON (Aegislash)', side: { type: 'SELECT_POKEMON', payload: { side: 'p1', pokemon: aegislash } }, config: { type: 'SELECT_POKEMON', payload: { pokemon: aegislash } } },
  { name: 'SELECT_MOVE_FOR_SLOT', side: { type: 'SELECT_MOVE_FOR_SLOT', payload: { side: 'p1', index: 1, move: move('Wood Hammer') } }, config: { type: 'SELECT_MOVE_FOR_SLOT', payload: { index: 1, move: move('Wood Hammer') } } },
  { name: 'CLEAR_MOVE_SLOT', side: { type: 'CLEAR_MOVE_SLOT', payload: { side: 'p1', index: 0 } }, config: { type: 'CLEAR_MOVE_SLOT', payload: { index: 0 } } },
  { name: 'SET_ACTIVE_MOVE_SLOT', side: { type: 'SET_ACTIVE_MOVE_SLOT', payload: { side: 'p1', index: 3 } }, config: { type: 'SET_ACTIVE_MOVE_SLOT', payload: { index: 3 } } },
  { name: 'SET_ABILITIES', side: { type: 'SET_ABILITIES', payload: { side: 'p1', abilities } }, config: { type: 'SET_ABILITIES', payload: { abilities } } },
  { name: 'SET_ACTIVE_ABILITY', side: { type: 'SET_ACTIVE_ABILITY', payload: { side: 'p1', ability: 'Overgrow' } }, config: { type: 'SET_ACTIVE_ABILITY', payload: { ability: 'Overgrow' } } },
  { name: 'SET_ITEM', side: { type: 'SET_ITEM', payload: { side: 'p1', item: 'Choice Band' } }, config: { type: 'SET_ITEM', payload: { item: 'Choice Band' } } },
  { name: 'SET_ITEM (clear)', side: { type: 'SET_ITEM', payload: { side: 'p1', item: null } }, config: { type: 'SET_ITEM', payload: { item: null } } },
  { name: 'SET_HP_PERCENT', side: { type: 'SET_HP_PERCENT', payload: { side: 'p1', val: 45 } }, config: { type: 'SET_HP_PERCENT', payload: { val: 45 } } },
  { name: 'SET_TYPE', side: { type: 'SET_TYPE', payload: { side: 'p1', slot: 2, type: 'water' } }, config: { type: 'SET_TYPE', payload: { slot: 2, type: 'water' } } },
  { name: 'TOGGLE_TYPE_OVERRIDE', side: { type: 'TOGGLE_TYPE_OVERRIDE', payload: { side: 'p1' } }, config: { type: 'TOGGLE_TYPE_OVERRIDE' } },
  { name: 'RESET_STATS', side: { type: 'RESET_STATS', payload: { side: 'p1' } }, config: { type: 'RESET_STATS' } },
  { name: 'APPLY_PRESET', side: { type: 'APPLY_PRESET', payload: { side: 'p1', pokemon: mon(), abilities, movesData, preset } }, config: { type: 'APPLY_PRESET', payload: { pokemon: mon(), abilities, movesData, preset } } },
  { name: 'APPLY_PRESET (Aegislash)', side: { type: 'APPLY_PRESET', payload: { side: 'p1', pokemon: aegislash, abilities, movesData, preset } }, config: { type: 'APPLY_PRESET', payload: { pokemon: aegislash, abilities, movesData, preset } } },
  { name: 'IMPORT_SHOWDOWN_SET', side: { type: 'IMPORT_SHOWDOWN_SET', payload: { side: 'p1', pokemon: mon(), abilities, movesData, set: showdownSet } }, config: { type: 'IMPORT_SHOWDOWN_SET', payload: { pokemon: mon(), abilities, movesData, set: showdownSet } } },
  { name: 'IMPORT_SHOWDOWN_SET (Aegislash)', side: { type: 'IMPORT_SHOWDOWN_SET', payload: { side: 'p1', pokemon: aegislash, abilities, movesData, set: showdownSet } }, config: { type: 'IMPORT_SHOWDOWN_SET', payload: { pokemon: aegislash, abilities, movesData, set: showdownSet } } },
];

describe('sideReducer and pokemonReducer agree on the build', () => {
  it('compares every PokemonConfig field', () => {
    // initialPokemonState lives in a type-checked file, so this fails if PokemonConfig
    // gains a field nobody decided about, or if a name in BUILD_FIELDS is misspelt.
    // `form` is optional, so it is absent from the initial state.
    expect([...BUILD_FIELDS].sort()).toEqual([...Object.keys(initialPokemonState), 'form'].sort());
  });

  it.each(CASES)('$name', ({ side, config }) => {
    expect(build(sideReducer(startSide, side))).toEqual(build(pokemonReducer(START, config)));
  });
});

describe('LOAD_CONFIG', () => {
  // Exempt from the table above because the two reducers take different payloads, but it
  // must still heal a missing form the way the calculator does: builds saved before the
  // field existed have none, and TOGGLE_AEGISLASH_FORM turns a missing form into swapped
  // stats labelled 'Shield'. This is the path saved teams actually take.
  const load = (config: PokemonConfig) => pokemonReducer(config, { type: 'LOAD_CONFIG', payload: config });

  it('gives a saved Aegislash build a form when it has none', () => {
    expect(load({ ...START, selectedId: AEGISLASH_ID, form: undefined }).form).toBe('Shield');
  });

  it('keeps the form a saved build already has', () => {
    expect(load({ ...START, selectedId: AEGISLASH_ID, form: 'Blade' }).form).toBe('Blade');
  });

  it('leaves every other species formless', () => {
    expect(load({ ...START, selectedId: 812 }).form).toBeUndefined();
  });
});

describe('TOGGLE_AEGISLASH_FORM', () => {
  it('agrees once a form is set', () => {
    const s: SideState = { ...startSide, selectedId: AEGISLASH_ID, form: 'Shield' };
    const c: PokemonConfig = { ...START, selectedId: AEGISLASH_ID, form: 'Shield' };
    expect(build(sideReducer(s, { type: 'TOGGLE_AEGISLASH_FORM', payload: { side: 'p1' } })))
      .toEqual(build(pokemonReducer(c, { type: 'TOGGLE_AEGISLASH_FORM' })));
  });
});
