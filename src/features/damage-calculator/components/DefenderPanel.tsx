import React from 'react';
import PokemonPanel from '@/components/organisms/PokemonPanel';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { CalcState, CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import { useCalculatorActions } from '@/features/damage-calculator/hooks/useCalculatorActions';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';

interface Props {
  state: CalcState;
  dispatch: React.Dispatch<CalcAction>;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  onApplySpread: (side: 'p1' | 'p2', spread: Spread) => void;
  onResetBuild: (side: 'p1' | 'p2') => void;
  /** Optional slot rendered above the panel (battle-roster chips). */
  defenderExtra?: React.ReactNode;
}

export const DefenderPanel: React.FC<Props> = ({ state, dispatch, pokemonList, moveList, onApplySpread, onResetBuild, defenderExtra }) => {
  const actions = useCalculatorActions(dispatch, pokemonList, moveList);
  const side = 'p2';

  return (
    <div>
      {defenderExtra}
      <PokemonPanel
      title="Pokémon 2"
      sideColor="bg-danger"
      side={side}
      pokemonList={pokemonList}
      selectedId={state[side].selectedId}
      onSelectPokemon={(p) => actions.handleSelectPokemon(side, p)}
      onSelectPreset={(preset) => actions.handleSelectPreset(side, preset)}
      onImportShowdown={(set) => actions.handleImportShowdown(side, set)}
      onLoadConfig={(config) => actions.handleLoadConfig(side, config)}
      stats={state[side]}
      onSpChange={(key, val) => dispatch({ type: 'SET_SP', payload: { side, key, val } })}
      onNatureChange={(nature) => dispatch({ type: 'SET_NATURE', payload: { side, nature } })}
      onApplySpread={(spread) => onApplySpread(side, spread)}
      onResetBuild={() => onResetBuild(side)}
      onToggleNature={(stat, mod) => dispatch({ type: 'TOGGLE_NATURE', payload: { side, stat, mod } })}
      stages={state[side].stages}
      onStageChange={(stat, val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side, stat, val } })}
      moveList={moveList}
      moves={state[side].moves}
      onSelectMove={(index, m) => dispatch({ type: 'SELECT_MOVE_FOR_SLOT', payload: { side, index, move: m } })}
      onClearMove={(index) => dispatch({ type: 'CLEAR_MOVE_SLOT', payload: { side, index } })}
      abilities={state[side].abilities}
      activeAbility={state[side].activeAbility}
      onAbilityChange={(ability) => dispatch({ type: 'SET_ACTIVE_ABILITY', payload: { side, ability } })}
      item={state[side].item}
      onItemChange={(item) => dispatch({ type: 'SET_ITEM', payload: { side, item } })}
      activeWeather={state.weather}
      hpPercent={state[side].hpPercent}
      onHpPercentChange={(val) => dispatch({ type: 'SET_HP_PERCENT', payload: { side, val } })}
      type1={state[side].type1}
      type2={state[side].type2}
      onTypeChange={(slot, type) => dispatch({ type: 'SET_TYPE', payload: { side, slot, type } })}
      isTypeOverridden={state[side].isTypeOverridden}
      onToggleTypeOverride={() => dispatch({ type: 'TOGGLE_TYPE_OVERRIDE', payload: { side } })}
      onToggleAegislashForm={() => dispatch({ type: 'TOGGLE_AEGISLASH_FORM', payload: { side } })}
      isReflect={state[side].isReflect}
      isLightScreen={state[side].isLightScreen}
      isAuroraVeil={state[side].isAuroraVeil}
      isHelpingHand={state[side].isHelpingHand}
      isFriendGuard={state[side].isFriendGuard}
      isTailwind={state[side].isTailwind}
      onToggleSideEffect={(effect) => dispatch({ type: 'TOGGLE_SIDE_EFFECT', payload: { side, effect } })}
      onResetStats={() => dispatch({ type: 'RESET_STATS', payload: { side } })}
      movesForceCrit={state[side].movesForceCrit}
      onToggleMoveCrit={(index) => dispatch({ type: 'TOGGLE_MOVE_CRIT', payload: { side, index } })}
      movesHits={state[side].movesHits}
      onUpdateMoveHits={(index, val) => dispatch({ type: 'SET_MOVE_HITS', payload: { side, index, val } })}
      faintedCount={state[side].faintedCount}
      onFaintedCountChange={(val) => dispatch({ type: 'SET_FAINTED_COUNT', payload: { side, val } })}
      />
    </div>
  );
};
