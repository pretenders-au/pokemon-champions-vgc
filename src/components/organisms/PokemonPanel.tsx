import React from 'react';
import Typography from '@/components/atoms/Typography';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { isMultiHitMove, getMultiHitLimits } from '@/features/damage-calculator/utils/damage-calc';
import { PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';
import PokemonConfigForm from '@/components/organisms/PokemonConfigForm';
import BuildPresets from '@/features/damage-calculator/components/BuildPresets';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';
import { calculateHP } from '@/features/damage-calculator/utils/damage-calc';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';

interface PokemonPanelProps {
  title: string;
  sideColor: string;
  side: 'p1' | 'p2';
  pokemonList: PokemonBaseStats[];
  selectedId: number | null;
  onSelectPokemon: (p: PokemonBaseStats) => void;
  onSelectPreset?: (preset: PokemonPreset) => void;
  onImportShowdown?: (set: ParsedShowdownSet) => void;
  onLoadConfig?: (config: any) => void;
  stats: any;
  onSpChange: (key: string, val: number) => void;
  onNatureChange: (nature: string) => void;
  onApplySpread: (spread: Spread) => void;
  onResetBuild: () => void;
  onToggleNature: (stat: string, mod: '+' | '-') => void;
  stages: Record<string, number>;
  onStageChange: (stat: string, val: number) => void;
  moveList: MoveData[];
  moves: (MoveData | null)[];
  onSelectMove: (index: number, m: MoveData) => void;
  onClearMove: (index: number) => void;
  abilities: string[];
  activeAbility: string | null;
  onAbilityChange: (ability: string) => void;
  item: string | null;
  onItemChange: (item: string | null) => void;
  activeWeather: 'None' | 'Sun' | 'Rain' | 'Sandstorm' | 'Snow';
  hpPercent: number;
  onHpPercentChange: (val: number) => void;
  type1: string | null;
  type2: string | null;
  onTypeChange: (slot: 1 | 2, type: string | null) => void;
  isTypeOverridden: boolean;
  onToggleTypeOverride: () => void;
  onToggleAegislashForm?: () => void;
  onResetStats?: () => void;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isHelpingHand: boolean;
  isFriendGuard: boolean;
  isTailwind: boolean;
  onToggleSideEffect: (effect: 'isReflect' | 'isLightScreen' | 'isAuroraVeil' | 'isHelpingHand' | 'isFriendGuard' | 'isTailwind') => void;
  movesForceCrit: boolean[];
  onToggleMoveCrit: (index: number) => void;
  movesHits: number[];
  onUpdateMoveHits: (index: number, val: number) => void;
  faintedCount: number;
  onFaintedCountChange: (val: number) => void;
}

const PokemonPanel: React.FC<PokemonPanelProps> = (props) => {
  const {
    title, sideColor, side, hpPercent, onHpPercentChange, stats,
    isReflect, isLightScreen, isAuroraVeil, isHelpingHand, isFriendGuard, isTailwind,
    onToggleSideEffect, movesForceCrit, onToggleMoveCrit, movesHits, onUpdateMoveHits,
    stages, onStageChange, faintedCount, onFaintedCountChange
  } = props;

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
    <div className="bg-card p-4 rounded-xl border border-line space-y-4 h-full">
      <PokemonConfigForm
        config={{
          selectedId: props.selectedId,
          type1: props.type1,
          type2: props.type2,
          baseHp: stats.baseHp,
          baseAtk: stats.baseAtk,
          baseDef: stats.baseDef,
          baseSpa: stats.baseSpa,
          baseSpd: stats.baseSpd,
          baseSpe: stats.baseSpe,
          spHp: stats.spHp,
          spAtk: stats.spAtk,
          spDef: stats.spDef,
          spSpa: stats.spSpa,
          spSpd: stats.spSpd,
          spSpe: stats.spSpe,
          nature: props.stats.nature || 'Hardy',
          moves: props.moves,
          activeMoveIndex: 0, 
          abilities: props.abilities,
          activeAbility: props.activeAbility,
          item: props.item,
          hpPercent: props.hpPercent,
          isTypeOverridden: props.isTypeOverridden,
          form: props.stats.form,
          stages: props.stages,
        } as any}
        pokemonList={props.pokemonList}
        moveList={props.moveList}
        onSelectPokemon={props.onSelectPokemon}
        onSelectPreset={props.onSelectPreset}
        onImportShowdown={props.onImportShowdown}
        onLoadConfig={props.onLoadConfig}
        onSpChange={props.onSpChange}
        onNatureChange={props.onNatureChange}
        onToggleNature={props.onToggleNature}
        onStageChange={props.onStageChange}
        onSelectMove={props.onSelectMove}
        onClearMove={props.onClearMove}
        onAbilityChange={props.onAbilityChange}
        onItemChange={props.onItemChange}
        onTypeChange={props.onTypeChange}
        onToggleTypeOverride={props.onToggleTypeOverride}
        onToggleAegislashForm={props.onToggleAegislashForm}
        onResetStats={props.onResetStats}
        title={title}
        sideColor={sideColor}
        renderMoveActions={renderMoveActions}
      />

      <BuildPresets onApplySpread={props.onApplySpread} onReset={props.onResetBuild} />

      <div className="bg-inset p-2 rounded-xl border border-line flex items-center gap-3">
        <div className="flex flex-col min-w-[70px]">
          <Typography variant="label" className="text-ink-3 uppercase tracking-widest text-[8px] font-black leading-tight mb-0.5">Current HP</Typography>
          <span className="text-[9px] font-black text-accent">
            {currentHp} / {maxHp} HP
          </span>
        </div>
        <input
          type="range"
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
  );
};

export default PokemonPanel;
