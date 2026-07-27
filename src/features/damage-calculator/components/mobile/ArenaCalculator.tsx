import React, { useState } from 'react';
import type { CalcState, CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import type { DamageResult } from '@/components/organisms/ResultsPanel';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';
import { useCalculatorActions } from '@/features/damage-calculator/hooks/useCalculatorActions';
import { buildSpeedCompare, speedFormula } from '@/features/damage-calculator/utils/speed';
import ShowdownImportModal from '@/components/organisms/ShowdownImportModal';
import { ArenaHud } from './ArenaHud';
import { ArenaMonCard } from './ArenaMonCard';
import { ArenaFieldConditions } from './ArenaFieldConditions';
import { ArenaMovePickerSheet } from './ArenaMovePickerSheet';
import { ArenaAdvancedSheet } from './ArenaAdvancedSheet';
import { ArenaPickerSheet, CorePickerField } from './ArenaPickerSheet';
import { ArenaSpeedCompareView } from './ArenaSpeedCompareView';

type Side = 'p1' | 'p2';
type PickerField = 'species' | 'move' | 'ability' | 'item' | 'nature';
type Actions = ReturnType<typeof useCalculatorActions>;

export function ArenaCalculator({
  state, dispatch, pokemonList, moveList, p1Results, p2Results, actions, onApplySpread, onResetBuild, onOpenScan, defenderExtra, attackerExtra,
}: {
  state: CalcState;
  dispatch: React.Dispatch<CalcAction>;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  p1Results: (DamageResult | null)[];
  p2Results: (DamageResult | null)[];
  p1MaxHp: number;
  p2MaxHp: number;
  actions: Actions;
  onApplySpread: (side: Side, spread: Spread) => void;
  onResetBuild: (side: Side) => void;
  /** Omitted in the overlay, where the chrome bar's "Scan active + HP" covers it. */
  onOpenScan?: () => void;
  /** Optional slot rendered under the Defender card's header (battle-roster chips). */
  defenderExtra?: React.ReactNode;
  /** Optional slot rendered under the Attacker card's header (my-team chips). */
  attackerExtra?: React.ReactNode;
}) {
  const [dir, setDir] = useState<Side>('p1');
  const [view, setView] = useState<'damage' | 'speed'>('damage');
  const [picker, setPicker] = useState<{ side: Side; field: CorePickerField } | null>(null);
  const [movePickerSide, setMovePickerSide] = useState<Side | null>(null);
  const [advancedSide, setAdvancedSide] = useState<Side | null>(null);
  const [showdownSide, setShowdownSide] = useState<Side | null>(null);

  const nameOf = (id: number | null) => pokemonList.find((p) => p.id === id)?.nameEn ?? '—';

  const openPicker = (side: Side) => (field: PickerField) => {
    if (field === 'move') setMovePickerSide(side);
    else setPicker({ side, field });
  };

  const defDir: Side = dir === 'p1' ? 'p2' : 'p1';
  const speed = buildSpeedCompare(
    {
      baseSpe: state[dir].baseSpe, spSpe: state[dir].spSpe,
      nature: state[dir].nature,
      speStage: state[dir].stages.spe || 0, item: state[dir].item, isTailwind: state[dir].isTailwind,
    },
    { baseSpe: state[defDir].baseSpe, speStage: state[defDir].stages.spe || 0, isTailwind: state[defDir].isTailwind },
  );

  return (
    <>
      <ArenaHud
        state={state}
        dir={dir}
        onSwap={() => setDir((d) => (d === 'p1' ? 'p2' : 'p1'))}
        p1Results={p1Results}
        p2Results={p2Results}
        nameOf={nameOf}
      />

      <div style={{ padding: '11px var(--gutter) 0' }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-inset)', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-1)' }}>
          {(['damage', 'speed'] as const).map((v) => {
            const on = view === v;
            return (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '7px 0', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                background: on ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${on ? 'var(--accent-soft-line)' : 'transparent'}`,
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--ink-3)',
              }}>{v === 'damage' ? 'Damage' : 'Speed'}</button>
            );
          })}
        </div>
      </div>

      {view === 'damage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 'var(--sp-4) var(--gutter) var(--sp-7)' }}>
          <ArenaMonCard side="p1" role="Attacker" state={state} dispatch={dispatch} nameOf={nameOf} onOpenPicker={openPicker('p1')} onOpenAdvanced={() => setAdvancedSide('p1')} extra={attackerExtra} results={p1Results} />
          <ArenaMonCard side="p2" role="Defender" state={state} dispatch={dispatch} nameOf={nameOf} onOpenPicker={openPicker('p2')} onOpenAdvanced={() => setAdvancedSide('p2')} extra={defenderExtra} results={p2Results} />

          {onOpenScan && (
            <button
              onClick={onOpenScan}
              style={{ minHeight: 44, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)', color: 'var(--accent-hover)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}
            >
              Scan opponent
            </button>
          )}

          <ArenaFieldConditions state={state} dispatch={dispatch} />

          <div style={{ border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)', padding: '12px var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ink-4)', marginBottom: 2, textTransform: 'uppercase' }}>SP stat system</div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>HP = Base + 75 + SP</code>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>Stat = floor((Base + 20 + SP) × Nature)</code>
          </div>
        </div>
      )}

      {view === 'speed' && (
        <div style={{ padding: 'var(--sp-4) var(--gutter) var(--sp-7)' }}>
          <ArenaSpeedCompareView
            compare={speed} layout="stacked"
            youName={nameOf(state[dir].selectedId)} oppName={nameOf(state[defDir].selectedId)}
            oppBaseSpe={state[defDir].baseSpe}
            youStage={state[dir].stages.spe || 0} oppStage={state[defDir].stages.spe || 0}
            onYouStage={(val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: dir, stat: 'spe', val } })}
            onOppStage={(val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: defDir, stat: 'spe', val } })}
            youSpeSp={state[dir].spSpe}
            onYouSpeSp={(i) => dispatch({ type: 'SET_SP', payload: { side: dir, key: 'spSpe', val: i } })}
            formula={speedFormula(state[dir])}
            trickRoom={state.isTrickRoom}
          />
        </div>
      )}

      {/* Advanced overflow sheet */}
      <ArenaAdvancedSheet
        open={!!advancedSide}
        side={advancedSide ?? 'p1'}
        onClose={() => setAdvancedSide(null)}
        state={state}
        dispatch={dispatch}
        onApplySpread={onApplySpread}
        onResetBuild={onResetBuild}
        onImportShowdown={() => { const s = advancedSide; setAdvancedSide(null); setShowdownSide(s); }}
      />

      {/* Move picker */}
      <ArenaMovePickerSheet
        open={!!movePickerSide}
        side={movePickerSide ?? 'p1'}
        onClose={() => setMovePickerSide(null)}
        state={state}
        dispatch={dispatch}
        moveList={moveList}
        results={movePickerSide === 'p2' ? p2Results : p1Results}
      />

      {/* Species / item / ability / nature picker */}
      <ArenaPickerSheet
        picker={picker}
        onClose={() => setPicker(null)}
        state={state}
        dispatch={dispatch}
        pokemonList={pokemonList}
        actions={actions}
      />

      {/* Showdown import (reuses the existing modal) */}
      <ShowdownImportModal
        isOpen={!!showdownSide}
        onClose={() => setShowdownSide(null)}
        onImport={(set) => { if (showdownSide) actions.handleImportShowdown(showdownSide, set); setShowdownSide(null); }}
      />
    </>
  );
}
