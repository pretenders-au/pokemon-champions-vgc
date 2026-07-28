import React from 'react';
import Typography from '@/components/atoms/Typography';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { isMultiHitMove, getMultiHitLimits } from '@/features/damage-calculator/utils/damage-calc';
import { PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';
import PokemonConfigForm from '@/components/organisms/PokemonConfigForm';
import BuildPresets from '@/features/damage-calculator/components/BuildPresets';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';
import type { CalcState, CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import { useSideEditor } from '@/features/damage-calculator/hooks/useSideEditor';
import { calculateHP } from '@/features/damage-calculator/utils/damage-calc';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';

interface SidePanelProps {
  side: 'p1' | 'p2';
  state: CalcState;
  dispatch: React.Dispatch<CalcAction>;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  onApplySpread: (spread: Spread) => void;
  onResetBuild: () => void;
  /** Optional slot rendered above the panel (my-team / battle-roster chips). */
  extra?: React.ReactNode;
}

const SIDE_CHROME = {
  p1: { title: 'Pokémon 1', color: 'bg-accent' },
  p2: { title: 'Pokémon 2', color: 'bg-danger' },
} as const;

/**
 * One side of the calculator: the shared build form plus the battle-only controls
 * (current HP, side effects, per-move crit/hits, fainted teammates, spread presets).
 *
 * Calculator-only, so it reads CalcState and dispatches directly; only the shared form
 * is addressed through BuildEditor.
 */
const SidePanel: React.FC<SidePanelProps> = ({
  side, state, dispatch, pokemonList, moveList, onApplySpread, onResetBuild, extra,
}) => {
  const stats = state[side];
  const editor = useSideEditor(side, dispatch, pokemonList, moveList);
  const { title, color: sideColor } = SIDE_CHROME[side];

  const {
    hpPercent, isReflect, isLightScreen, isAuroraVeil, isHelpingHand, isFriendGuard, isTailwind,
    movesForceCrit, movesHits, stages, faintedCount,
  } = stats;

  const onHpPercentChange = (val: number) => dispatch({ type: 'SET_HP_PERCENT', payload: { side, val } });
  const onToggleSideEffect = (effect: 'isReflect' | 'isLightScreen' | 'isAuroraVeil' | 'isHelpingHand' | 'isFriendGuard' | 'isTailwind') =>
    dispatch({ type: 'TOGGLE_SIDE_EFFECT', payload: { side, effect } });
  const onToggleMoveCrit = (index: number) => dispatch({ type: 'TOGGLE_MOVE_CRIT', payload: { side, index } });
  const onUpdateMoveHits = (index: number, val: number) => dispatch({ type: 'SET_MOVE_HITS', payload: { side, index, val } });
  const onFaintedCountChange = (val: number) => dispatch({ type: 'SET_FAINTED_COUNT', payload: { side, val } });

  const maxHp = calculateHP(stats.baseHp, stats.spHp);
  const currentHp = Math.floor(maxHp * (hpPercent / 100));

  const renderMoveActions = (move: MoveData | null, idx: number) => (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMoveCrit(idx);
        }}
        className={`
          px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all border
          ${movesForceCrit[idx]
            ? 'bg-danger-soft text-danger border border-danger-line'
            : 'bg-inset border-line-2 text-ink-4 hover:border-danger-line hover:text-danger'}
        `}
        title="Force Critical Hit"
      >
        Crit
      </button>

      {move && isMultiHitMove(move.nameEn) && (() => {
        const { min, max } = getMultiHitLimits(move.nameEn);
        return (
          <div className="flex items-center gap-1 bg-accent-soft px-1.5 py-0.5 rounded border border-accent-soft-line">
            <span className="text-[8px] font-black text-accent uppercase tracking-tighter">Hits</span>
            <input
              type="number"
              min={min}
              max={max}
              value={Math.min(max, Math.max(min, movesHits[idx]))}
              onChange={(e) => onUpdateMoveHits(idx, Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
              className="w-7 bg-transparent text-[10px] font-black text-accent text-center outline-none border-none"
            />
          </div>
        );
      })()}
    </>
  );

  return (
    <div className="space-y-4">
      {extra}
      <div className="bg-card p-4 rounded-xl border border-line space-y-4 h-full">
      <PokemonConfigForm
        config={stats}
        pokemonList={pokemonList}
        moveList={moveList}
        actions={editor}
        stages={stages}
        title={title}
        sideColor={sideColor}
        renderMoveActions={renderMoveActions}
      />

      <BuildPresets onApplySpread={onApplySpread} onReset={onResetBuild} />

      <div className="bg-inset p-2 rounded-xl border border-line flex items-center gap-3">
        <div className="flex flex-col min-w-[70px]">
          <Typography variant="label" className="text-ink-3 uppercase tracking-widest text-[8px] font-black leading-tight mb-0.5">Current HP</Typography>
          <span className="text-[9px] font-black text-accent">
            {currentHp} / {maxHp} HP
          </span>
        </div>
        <input
          type="range"
          aria-label="Current HP percent"
          min="0"
          max="100"
          value={Math.round(hpPercent)}
          onChange={(e) => onHpPercentChange(parseInt(e.target.value, 10))}
          className="flex-1 h-1.5 bg-inset rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max={maxHp}
            value={currentHp}
            onChange={(e) => {
              const targetHp = Math.min(maxHp, Math.max(0, parseInt(e.target.value, 10) || 0));
              onHpPercentChange((targetHp / maxHp) * 100);
            }}
            className="w-10 bg-card border border-line-2 text-center text-[10px] font-black text-accent rounded py-0.5 px-0.5 outline-none focus:border-accent transition-colors"
          />
          <span className="text-[9px] font-black text-ink-3 mr-1">/ {maxHp}</span>

          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(hpPercent)}
            onChange={(e) => onHpPercentChange(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
            className="w-9 bg-card border border-line-2 text-center text-[10px] font-black text-accent rounded py-0.5 px-0.5 outline-none focus:border-accent transition-colors"
          />
          <span className="text-[9px] font-black text-ink-3">%</span>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-line">
        <Typography variant="label" className="text-ink-3 block mb-1 uppercase tracking-widest text-[10px] font-black">Support & Field Effects</Typography>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {[
            { id: 'isReflect', label: 'Reflect', value: isReflect },
            { id: 'isLightScreen', label: 'Light Screen', value: isLightScreen },
            { id: 'isAuroraVeil', label: 'Aurora Veil', value: isAuroraVeil },
            { id: 'isHelpingHand', label: 'Helping Hand', value: isHelpingHand },
            { id: 'isFriendGuard', label: 'Friend Guard', value: isFriendGuard },
            { id: 'isTailwind', label: 'Tailwind', value: isTailwind },
          ].map((effect) => (
            <label key={effect.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={effect.value}
                onChange={() => onToggleSideEffect(effect.id as any)}
                className="w-3.5 h-3.5 rounded border-line-2 text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-[10px] font-bold text-ink-2 group-hover:text-ink-1 transition-colors uppercase tracking-tight">
                {effect.label}
              </span>
            </label>
          ))}
        </div>
        <div className="pt-2 flex items-center justify-between">
          <Typography variant="label" className="text-ink-3 uppercase tracking-widest text-[10px] font-black">Fainted Teammates</Typography>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5"
              value={faintedCount}
              onChange={(e) => onFaintedCountChange(parseInt(e.target.value, 10))}
              className="w-24 h-1.5 bg-inset rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="text-[10px] font-black text-accent w-4 text-center">{faintedCount}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SidePanel;
