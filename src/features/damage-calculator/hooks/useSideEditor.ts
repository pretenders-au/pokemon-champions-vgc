import React from 'react';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { BuildEditor } from '@/features/pokemon/hooks/usePokemonEditor';
import type { CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import { useCalculatorActions } from '@/features/damage-calculator/hooks/useCalculatorActions';

/**
 * The calculator's adapter to `BuildEditor` — one side of the battle, edited through
 * `sideReducer`. The team editor's adapter is `usePokemonEditor`.
 *
 * Every edit carries the side it was built for, so a panel cannot dispatch at the wrong
 * Pokémon. The dex-dependent edits (species, preset, Showdown import) go through
 * `useCalculatorActions`, which reads abilities before dispatching.
 */
export function useSideEditor(
  side: 'p1' | 'p2',
  dispatch: React.Dispatch<CalcAction>,
  pokemonList: PokemonBaseStats[],
  moveList: MoveData[]
): BuildEditor {
  const actions = useCalculatorActions(dispatch, pokemonList, moveList);

  return {
    selectPokemon: (p) => actions.handleSelectPokemon(side, p),
    selectPreset: (preset) => actions.handleSelectPreset(side, preset),
    importShowdown: (set) => actions.handleImportShowdown(side, set),
    loadConfig: (config) => actions.handleLoadConfig(side, config),
    setSp: (key, val) => dispatch({ type: 'SET_SP', payload: { side, key, val } }),
    setNature: (nature) => dispatch({ type: 'SET_NATURE', payload: { side, nature } }),
    toggleNature: (stat, mod) => dispatch({ type: 'TOGGLE_NATURE', payload: { side, stat, mod } }),
    setStage: (stat, val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side, stat, val } }),
    setMove: (index, move) => dispatch({ type: 'SELECT_MOVE_FOR_SLOT', payload: { side, index, move } }),
    clearMove: (index) => dispatch({ type: 'CLEAR_MOVE_SLOT', payload: { side, index } }),
    setAbility: (ability) => dispatch({ type: 'SET_ACTIVE_ABILITY', payload: { side, ability } }),
    setItem: (item) => dispatch({ type: 'SET_ITEM', payload: { side, item } }),
    setType: (slot, type) => dispatch({ type: 'SET_TYPE', payload: { side, slot, type } }),
    toggleTypeOverride: () => dispatch({ type: 'TOGGLE_TYPE_OVERRIDE', payload: { side } }),
    toggleAegislashForm: () => dispatch({ type: 'TOGGLE_AEGISLASH_FORM', payload: { side } }),
    resetStats: () => dispatch({ type: 'RESET_STATS', payload: { side } }),
  };
}
