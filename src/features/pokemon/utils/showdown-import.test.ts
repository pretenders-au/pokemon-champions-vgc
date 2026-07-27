import { describe, it, expect, vi } from 'vitest';
import { resolveSetWith, resolveSet, resolveSets, toConfig, type Dex, type AbilityRow } from './showdown-import';
import type { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

const pokemonList = [
  { id: 445, identifier: 'garchomp', nameEn: 'Garchomp', nameZh: '烈咬陸鯊', type1: 'dragon', type2: 'ground',
    baseHp: 108, baseAttack: 130, baseDefense: 95, baseSpAtk: 80, baseSpDef: 85, baseSpeed: 102 },
  { id: 876, identifier: 'indeedee-male', nameEn: 'Indeedee (Male)', nameZh: null, type1: 'psychic', type2: 'normal',
    baseHp: 60, baseAttack: 65, baseDefense: 55, baseSpAtk: 105, baseSpDef: 95, baseSpeed: 95 },
] as PokemonBaseStats[];

const moveList = [
  { id: 1, nameEn: 'Earthquake', nameZh: '地震', typeId: 5 },
  { id: 2, nameEn: 'Protect', nameZh: '守住', typeId: 1 },
] as unknown as MoveData[];

const GARCHOMP_ABILITIES: AbilityRow[] = [
  { nameEn: 'Sand Veil', nameZh: '沙隱' },
  { nameEn: 'Rough Skin', nameZh: '粗糙皮膚' },
];

const set = (over: Partial<ParsedShowdownSet> = {}): ParsedShowdownSet => ({
  species: 'Garchomp', item: 'Rocky Helmet', ability: 'Rough Skin', nature: 'Jolly',
  evs: { hp: 0, atk: 32, def: 1, spa: 0, spd: 0, spe: 32 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ['Earthquake', 'Protect'],
  ...over,
});

const dex = (getAbilities = vi.fn(async () => GARCHOMP_ABILITIES)): Dex =>
  ({ pokemonList, moveList, getAbilities });

const resolve = (s: ParsedShowdownSet, rows: AbilityRow[] | null = GARCHOMP_ABILITIES) =>
  resolveSetWith(s, pokemonList, moveList, rows);

describe('resolveSetWith — success', () => {
  it('resolves species, ability, item and moves with no corrections when everything matches exactly', () => {
    const { resolved, corrections, errors } = resolve(set());
    expect(errors).toEqual([]);
    expect(corrections).toEqual([]);
    expect(resolved?.pokemon.id).toBe(445);
    expect(resolved?.activeAbility).toBe('Rough Skin');
    expect(resolved?.abilityNames).toEqual(['Sand Veil', 'Rough Skin']);
    expect(resolved?.item).toBe('Rocky Helmet');
  });

  it('pads moves to four slots', () => {
    const { resolved } = resolve(set());
    expect(resolved?.movesData).toHaveLength(4);
    expect(resolved?.movesData[0]?.nameEn).toBe('Earthquake');
    expect(resolved?.movesData[1]?.nameEn).toBe('Protect');
    expect(resolved?.movesData[2]).toBeNull();
  });

  it('reports a correction for each fuzzy match without failing', () => {
    const { resolved, corrections, errors } = resolve(
      set({ species: 'Garchom', ability: 'Rough Skn', item: 'Rocky Helmt', moves: ['Earthquak'] })
    );
    expect(errors).toEqual([]);
    expect(resolved?.pokemon.id).toBe(445);
    expect(corrections).toHaveLength(4);
    expect(corrections.join('\n')).toContain('Garchom ➔ Garchomp');
    expect(corrections.join('\n')).toContain('Rough Skn ➔ Rough Skin');
  });

  it('resolves a bilingual set and reports the Chinese terms as corrections', () => {
    const { resolved, corrections, errors } = resolve(
      set({ species: '烈咬陸鯊', ability: '粗糙皮膚', item: '凹凸頭盔', moves: ['地震', '守住'] })
    );
    expect(errors).toEqual([]);
    expect(resolved?.pokemon.id).toBe(445);
    expect(resolved?.activeAbility).toBe('Rough Skin');
    expect(resolved?.item).toBe('Rocky Helmet');
    expect(resolved?.movesData[0]?.nameEn).toBe('Earthquake');
    expect(corrections.length).toBeGreaterThan(0);
  });

  it('resolves Showdown form suffixes against the dex parenthesised names', () => {
    // normalize() strips hyphens and parens, so these are an exact match, not a fuzzy one.
    const list = [{ ...pokemonList[0], id: 892, identifier: 'urshifu-rapid-strike', nameEn: 'Urshifu (Rapid Strike)' }] as PokemonBaseStats[];
    const { resolved, corrections } = resolveSetWith(set({ species: 'Urshifu-Rapid-Strike' }), list, moveList, null);
    expect(resolved?.pokemon.id).toBe(892);
    expect(corrections.some((c) => c.startsWith('Pokémon:'))).toBe(false);
  });

  it('resolves a Showdown gender suffix to the matching dex row', () => {
    // The dex data gap ADR-0001 recorded is closed: `Meowstic (Female)` (id 10025) exists.
    // Levenshtein alone still can't bridge `-F` to `(Female)` — it scores 0.64, below the
    // 0.75 threshold and below the male row's 0.67 — so matchSpecies expands the gender
    // suffix and reports the expansion as a correction.
    const list = [
      { ...pokemonList[0], id: 678, identifier: 'meowstic-male', nameEn: 'Meowstic (Male)' },
      { ...pokemonList[0], id: 10025, identifier: 'meowstic-female', nameEn: 'Meowstic (Female)' },
    ] as PokemonBaseStats[];
    const { resolved, corrections, errors } = resolveSetWith(set({ species: 'Meowstic-F' }), list, moveList, null);
    expect(errors).toEqual([]);
    expect(resolved?.pokemon.id).toBe(10025);
    expect(corrections).toContain('Pokémon: Meowstic-F ➔ Meowstic (Female)');
    // and Showdown's bare name is the male (default) form
    expect(resolveSetWith(set({ species: 'Meowstic' }), list, moveList, null).resolved?.pokemon.id).toBe(678);
  });
});

describe('resolveSetWith — failure policy', () => {
  it('is fatal for an unknown species: no resolution, one error', () => {
    const { resolved, errors } = resolve(set({ species: 'Mewnobody' }));
    expect(resolved).toBeNull();
    expect(errors).toEqual([{ kind: 'species', value: 'Mewnobody' }]);
  });

  it('does not fall back to a loose prefix match for gendered forms absent from the dex', () => {
    // ADR-0001: given a dex with no Female row, Meowstic-F must be reported, never
    // silently resolved to Meowstic (Male). The real dex now has one — see above.
    const list = [{ ...pokemonList[0], id: 678, identifier: 'meowstic-male', nameEn: 'Meowstic (Male)' }] as PokemonBaseStats[];
    const { resolved, errors } = resolveSetWith(set({ species: 'Meowstic-F' }), list, moveList, null);
    expect(resolved).toBeNull();
    expect(errors).toEqual([{ kind: 'species', value: 'Meowstic-F' }]);
  });

  it('picks the alternate form, not the base species, when both are legal', () => {
    // ADR-0001: the old prefix fallback exact-matched 'tauros' and returned base Tauros.
    const list = [
      { ...pokemonList[0], id: 128, identifier: 'tauros', nameEn: 'Tauros', type1: 'normal', type2: null },
      { ...pokemonList[0], id: 1128, identifier: 'tauros-paldea-aqua', nameEn: 'Tauros (Paldea Aqua Breed)', type1: 'fighting', type2: 'water' },
    ] as PokemonBaseStats[];
    const { resolved } = resolveSetWith(set({ species: 'Tauros-Paldea-Aqua' }), list, moveList, null);
    expect(resolved?.pokemon.nameEn).toBe('Tauros (Paldea Aqua Breed)');
  });

  it('is non-fatal for an unknown ability: still resolves, reports, keeps the default', () => {
    const { resolved, errors } = resolve(set({ ability: 'Nonsense Ability' }));
    expect(resolved).not.toBeNull();
    expect(errors).toEqual([{ kind: 'ability', value: 'Nonsense Ability' }]);
    expect(resolved?.activeAbility).toBe('Sand Veil'); // first slot
  });

  it('is non-fatal for an unknown item: still resolves, leaves the raw value', () => {
    const { resolved, errors } = resolve(set({ item: 'Nonsense Item' }));
    expect(resolved).not.toBeNull();
    expect(errors).toEqual([{ kind: 'item', value: 'Nonsense Item' }]);
    expect(resolved?.item).toBe('Nonsense Item');
  });

  it('is non-fatal for an unknown move: still resolves, leaves that slot null', () => {
    const { resolved, errors } = resolve(set({ moves: ['Earthquake', 'Nonsense Move'] }));
    expect(resolved).not.toBeNull();
    expect(errors).toEqual([{ kind: 'move', value: 'Nonsense Move' }]);
    expect(resolved?.movesData[0]?.nameEn).toBe('Earthquake');
    expect(resolved?.movesData[1]).toBeNull();
  });

  it('collects every field failure rather than stopping at the first', () => {
    const { resolved, errors } = resolve(set({ ability: 'Nope', item: 'Nope', moves: ['Nope'] }));
    expect(resolved).not.toBeNull();
    expect(errors).toHaveLength(3);
  });
});

describe('resolveSetWith — ability rows null vs empty', () => {
  it('null rows: carries set.ability unvalidated, into both the active slot and the list', () => {
    // The render-time (synchronous) caller has no ability list; absence must not mean "invalid".
    const { resolved, errors } = resolve(set({ ability: 'Rough Skin' }), null);
    expect(errors).toEqual([]);
    expect(resolved?.activeAbility).toBe('Rough Skin');
    expect(resolved?.abilityNames).toEqual(['Rough Skin']);
  });

  it('null rows: leaves activeAbility null when the set has none', () => {
    const { resolved } = resolve(set({ ability: null }), null);
    expect(resolved?.activeAbility).toBeNull();
    expect(resolved?.abilityNames).toEqual([]);
  });

  it('empty rows mean the species has no abilities, so a stated one is reported', () => {
    const { resolved, errors } = resolve(set({ ability: 'Rough Skin' }), []);
    expect(errors).toEqual([{ kind: 'ability', value: 'Rough Skin' }]);
    expect(resolved?.activeAbility).toBeNull();
  });
});

describe('resolveSet', () => {
  it('fetches abilities for the matched species', async () => {
    const getAbilities = vi.fn(async () => GARCHOMP_ABILITIES);
    const { resolved } = await resolveSet(set(), dex(getAbilities));
    expect(getAbilities).toHaveBeenCalledWith(445);
    expect(resolved?.activeAbility).toBe('Rough Skin');
  });

  it('does not fetch abilities when the species did not match', async () => {
    const getAbilities = vi.fn(async () => GARCHOMP_ABILITIES);
    const { resolved } = await resolveSet(set({ species: 'Mewnobody' }), dex(getAbilities));
    expect(getAbilities).not.toHaveBeenCalled();
    expect(resolved).toBeNull();
  });

  it('reports the ability when the lookup rejects, as the pre-module encoders did', async () => {
    const getAbilities = vi.fn(async () => { throw new Error('db down'); });
    const { resolved, errors } = await resolveSet(set(), dex(getAbilities as never));
    expect(resolved).not.toBeNull();
    expect(errors).toEqual([{ kind: 'ability', value: 'Rough Skin' }]);
  });
});

describe('resolveSets', () => {
  it('keeps the members that resolved and reports the ones that did not', async () => {
    const { members, errors } = await resolveSets(
      [set(), set({ species: 'Mewnobody' }), set()],
      dex()
    );
    expect(members).toHaveLength(2);
    expect(errors).toEqual([{ kind: 'species', value: 'Mewnobody' }]);
  });

  it('accumulates corrections across sets', async () => {
    const { members, corrections } = await resolveSets([set({ species: 'Garchom' }), set()], dex());
    expect(members).toHaveLength(2);
    expect(corrections).toEqual(['Pokémon: Garchom ➔ Garchomp']);
  });

  it('resolves an empty list to an empty team', async () => {
    expect(await resolveSets([], dex())).toEqual({ members: [], corrections: [], errors: [] });
  });
});

describe('toConfig', () => {
  it('maps base stats, SP and the nature pair onto a PokemonConfig', () => {
    const { resolved } = resolve(set());
    const c = toConfig(set(), resolved!);
    expect(c.selectedId).toBe(445);
    expect(c.baseSpe).toBe(102); // PokemonBaseStats.baseSpeed → config.baseSpe
    expect(c.spAtk).toBe(32); // set.evs are already SP-scale — passed straight through
    expect(c.item).toBe('Rocky Helmet');
    expect(c.activeAbility).toBe('Rough Skin');
    expect(c.abilities).toEqual(['Sand Veil', 'Rough Skin']);
    // Jolly = +Spe / -SpA
    expect(c.nature).toBe('Jolly (+SPE, -SPA)');
    expect(c.moves).toHaveLength(4);
    expect(c.hpPercent).toBe(100);
  });

  it('formats the nature name', () => {
    const { resolved } = resolve(set({ nature: 'Jolly' }));
    expect(toConfig(set({ nature: 'Jolly' }), resolved!).nature).toBe('Jolly (+SPE, -SPA)');
  });
});
