import { getDb } from '@/db';
import { abilities, pokemonAbilities } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import { resolveSet, KIND_LABEL } from '@/features/pokemon/utils/showdown-import';
import { appDex } from '@/features/pokemon/utils/appDex';

export function useCalculatorActions(
  dispatch: React.Dispatch<CalcAction>,
  pokemonList: PokemonBaseStats[],
  moveList: MoveData[]
) {
  const handleSelectPokemon = async (side: 'p1' | 'p2', p: PokemonBaseStats) => {
    dispatch({ type: 'SELECT_POKEMON', payload: { side, pokemon: p } });
    
    try {
      const db = await getDb();
      const abilityResult = await db.select({
        name: abilities.nameEn
      })
      .from(pokemonAbilities)
      .innerJoin(abilities, eq(pokemonAbilities.abilityId, abilities.id))
      .where(eq(pokemonAbilities.pokemonId, p.id))
      .orderBy(pokemonAbilities.slot);

      const abilityNames = abilityResult.map(a => a.name).filter((name): name is string => !!name);
      dispatch({ type: 'SET_ABILITIES', payload: { side, abilities: abilityNames } });
    } catch (error) {
      console.error('Failed to fetch abilities:', error);
    }
  };

  // Mega evolve / revert: swap species fields but keep the side's build
  // (moves, SP, nature, ranks, item, HP) — only the abilities refresh.
  const handleSwapForm = async (side: 'p1' | 'p2', p: PokemonBaseStats) => {
    dispatch({ type: 'SWAP_FORM', payload: { side, pokemon: p } });
    try {
      const db = await getDb();
      const abilityResult = await db.select({ name: abilities.nameEn })
        .from(pokemonAbilities)
        .innerJoin(abilities, eq(pokemonAbilities.abilityId, abilities.id))
        .where(eq(pokemonAbilities.pokemonId, p.id))
        .orderBy(pokemonAbilities.slot);
      const abilityNames = abilityResult.map(a => a.name).filter((name): name is string => !!name);
      dispatch({ type: 'SET_ABILITIES', payload: { side, abilities: abilityNames } });
    } catch (error) {
      console.error('Failed to fetch abilities:', error);
    }
  };

  const handleSelectPreset = async (side: 'p1' | 'p2', preset: PokemonPreset) => {
    const p = pokemonList.find(p => p.nameEn === preset.pokemonName);
    if (!p) return;
    
    let abilityNames: string[] = [];
    try {
      const db = await getDb();
      const abilityResult = await db.select({ name: abilities.nameEn })
        .from(pokemonAbilities)
        .innerJoin(abilities, eq(pokemonAbilities.abilityId, abilities.id))
        .where(eq(pokemonAbilities.pokemonId, p.id))
        .orderBy(pokemonAbilities.slot);
      abilityNames = abilityResult.map(a => a.name).filter((name): name is string => !!name);
    } catch (e) {}

    const movesData = preset.moves.map(mName => moveList.find(m => m.nameEn === mName) || null);

    while (movesData.length < 4) {
      movesData.push(null);
    }

    dispatch({
      type: 'APPLY_PRESET',
      payload: {
        side,
        pokemon: p,
        abilities: abilityNames,
        movesData: movesData.slice(0, 4),
        preset
      }
    });
  };

  const handleImportShowdown = async (side: 'p1' | 'p2', set: ParsedShowdownSet) => {
    const result = await resolveSet(set, appDex(pokemonList, moveList));

    // Loading one side aborts on the first failure, in the order set resolution
    // reports them: species, ability, item, then moves.
    if (!result.ok || result.errors.length > 0) {
      const { kind, value } = result.errors[0];
      alert(`Could not find ${KIND_LABEL[kind]} matching "${value}"`);
      return;
    }
    const { corrections } = result;
    const { pokemon: p, abilityNames, activeAbility, item, movesData } = result.resolved;

    const updatedSet = {
      ...set,
      species: p.nameEn,
      ability: activeAbility,
      item: item,
    };

    dispatch({
      type: 'IMPORT_SHOWDOWN_SET',
      payload: {
        side,
        pokemon: p,
        abilities: abilityNames,
        movesData: movesData.slice(0, 4),
        set: updatedSet
      }
    });

    if (corrections.length > 0) {
      window.dispatchEvent(new CustomEvent('showdown-imported', { detail: { side, corrections } }));
    }

    return corrections;
  };

  const handleLoadConfig = async (side: 'p1' | 'p2', config: any) => {
    const p = pokemonList.find(p => p.id === config.selectedId);
    if (!p) return;
    
    let abilityNames: string[] = [];
    try {
      const db = await getDb();
      const abilityResult = await db.select({ name: abilities.nameEn })
        .from(pokemonAbilities)
        .innerJoin(abilities, eq(pokemonAbilities.abilityId, abilities.id))
        .where(eq(pokemonAbilities.pokemonId, p.id))
        .orderBy(pokemonAbilities.slot);
      abilityNames = abilityResult.map(a => a.name).filter((name): name is string => !!name);
    } catch (e) {}

    const movesData = config.moves.map((m: any) => m ? (moveList.find(move => move.nameEn === m.nameEn) || null) : null);

    while (movesData.length < 4) {
      movesData.push(null);
    }

    dispatch({
      type: 'LOAD_CONFIG',
      payload: {
        side,
        config,
        pokemon: p,
        abilities: abilityNames,
        movesData: movesData.slice(0, 4)
      }
    });
  };

  return { handleSelectPokemon, handleSwapForm, handleSelectPreset, handleImportShowdown, handleLoadConfig };
}
