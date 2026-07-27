import React, { useState } from 'react';
import type { CalcState, CalcAction, SideState } from '@/features/damage-calculator/hooks/useCalculatorState';
import type { DamageResult } from '@/components/organisms/ResultsPanel';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';
import { useCalculatorActions } from '@/features/damage-calculator/hooks/useCalculatorActions';
import { useDamageScenarios, ScenarioRange } from '@/features/damage-calculator/hooks/useDamageScenarios';
import { buildSpeedCompare, speedFormula } from '@/features/damage-calculator/utils/speed';
import { megaCycleTarget } from '@/features/damage-calculator/utils/mega';
import { REVERSE_TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import { natureMultiplier, natureForStatWheel } from '@/features/pokemon/utils/pokemon-natures';
import { Sprite, KOVerdict, koVerdictFromText, Icon, TypeBadge, WheelPicker, SP_OPTIONS, RANK_OPTIONS, NATURE_OPTIONS } from '@/design-system/arena';
import type { KoTone } from '@/design-system/arena';
import { ArenaPickerSheet, CorePickerField } from './ArenaPickerSheet';
import { ArenaMovePickerSheet } from './ArenaMovePickerSheet';
import { ArenaAdvancedSheet } from './ArenaAdvancedSheet';
import { ArenaBattlefieldRow } from './ArenaBattlefieldRow';
import { ArenaSpeedCompareView } from './ArenaSpeedCompareView';
import { computeStatRows } from './ArenaStatCard';
import ShowdownImportModal from '@/components/organisms/ShowdownImportModal';

type Side = 'p1' | 'p2';
type Actions = ReturnType<typeof useCalculatorActions>;

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const KO_COLOR: Record<KoTone, string> = { safe: 'var(--safe)', danger: 'var(--danger)', field: 'var(--field)' };

/* ---------- shared inline styles (from the 7a design tokens) ---------- */

const microBtn: React.CSSProperties = { width: 18, height: 18, flex: 'none', borderRadius: 5, background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center', padding: 0 };
const metaPill: React.CSSProperties = { flex: '1 1 0', minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--line-1)', color: 'var(--ink-2)', fontSize: 9.5, fontWeight: 600, cursor: 'pointer' };
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', minHeight: 24, borderRadius: 8, background: 'transparent', border: '1px dashed var(--line-2)', color: 'var(--ink-3)', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' };
const microHdr: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const moveRowStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 28, textAlign: 'left', padding: '2px 7px',
  borderRadius: 8, cursor: 'pointer',
  background: active ? 'var(--accent-soft)' : 'var(--surface-inset)',
  border: `1px solid ${active ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
});

/* ---------- small presentational helpers ---------- */

function SmallBadge({ tone, children }: { tone: 'accent' | 'danger'; children: React.ReactNode }) {
  const c = tone === 'accent' ? 'var(--accent)' : 'var(--danger)';
  const soft = tone === 'accent' ? 'var(--accent-soft)' : 'var(--danger-soft)';
  const line = tone === 'accent' ? 'var(--accent-soft-line)' : 'var(--danger-line)';
  return (
    <span style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: c, background: soft, border: `1px solid ${line}`, borderRadius: 999, padding: '1px 6px' }}>
      {children}
    </span>
  );
}

function StatBlock({ side }: { side: SideState }) {
  const rows = side.selectedId ? computeStatRows(side) : [];
  if (!rows.length) return null;
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 9.5, lineHeight: 1.3 }}>
          <span style={{ color: 'var(--ink-4)', width: 8 }}>{r.l1}</span>
          <span style={{ color: 'var(--ink-1)', fontWeight: 700, width: 24, textAlign: 'right' }}>{r.v1}</span>
          <span style={{ color: 'var(--ink-4)', width: 8 }}>{r.l2}</span>
          <span style={{ color: 'var(--ink-1)', fontWeight: 700, width: 24, textAlign: 'right' }}>{r.v2}</span>
        </div>
      ))}
    </div>
  );
}

function SideHeader({ side, name, tone, badge, onOpenSpecies, mega }: {
  side: SideState; name: string; tone: 'accent' | 'danger'; badge: string; onOpenSpecies: () => void;
  mega?: { label: string; onClick: () => void } | null;
}) {
  const ring = tone === 'accent' ? 'var(--accent)' : 'var(--danger)';
  const glow = tone === 'accent' ? 'var(--accent-soft)' : 'var(--danger-soft)';
  const types = [side.type1, side.type2].filter(Boolean) as string[];
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Sprite dex={side.selectedId} name={name} size={46} style={{ border: `2px solid ${ring}`, boxShadow: `0 0 0 2px ${glow}` }} />
      <div role="button" tabIndex={0} onClick={onOpenSpecies} onKeyDown={(e) => { if (e.key === 'Enter') onOpenSpecies(); }} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Select'}</span>
          <SmallBadge tone={tone}>{badge}</SmallBadge>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
          {mega && (
            <button
              onClick={(e) => { e.stopPropagation(); mega.onClick(); }}
              style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--field)', background: 'var(--field-soft)', border: '1px solid var(--field-line)', borderRadius: 999, padding: '1px 6px', cursor: 'pointer' }}
            >
              {mega.label}
            </button>
          )}
        </div>
      </div>
      <StatBlock side={side} />
    </div>
  );
}

function MetaPill({ icon, label, onClick }: { icon: 'sparkles' | 'shield'; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={metaPill}>
      <Icon name={icon} size={10} color="var(--ink-3)" />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function MoveRow({ move, result, active, showBp, onClick }: {
  move: MoveData | null; result: DamageResult | null; active: boolean; showBp?: boolean; onClick: () => void;
}) {
  if (!move) {
    return (
      <button onClick={onClick} style={{ ...moveRowStyle(false), border: '1px dashed var(--line-2)', color: 'var(--ink-4)', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600 }}>
        Add move
      </button>
    );
  }
  const typeName = REVERSE_TYPE_IDS[result?.moveType ?? move.typeId];
  return (
    <button onClick={onClick} style={moveRowStyle(active)}>
      {typeName && <TypeBadge type={typeName} size="sm" />}
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: active ? 'var(--ink-1)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{move.nameEn}</span>
      {showBp && move.power != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', flex: 'none' }}>{move.power}</span>}
      <span style={{ flex: 'none', fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--ink-1)', whiteSpace: 'nowrap' }}>
        {result ? `${result.minPercent}–${result.maxPercent}%` : '—'}
      </span>
    </button>
  );
}

function ScenarioRow({ label, range }: { label: string; range: ScenarioRange | null }) {
  if (!range) return null;
  const danger = range.maxPercent >= 100;
  const ko = koVerdictFromText(range.koChanceText);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>{range.minPercent}–{range.maxPercent}%</span>
        {range.koChanceText && <span style={{ fontSize: 9.5, fontWeight: 700, color: KO_COLOR[ko.tone], whiteSpace: 'nowrap' }}>{ko.verdict}</span>}
      </div>
      <div style={{ marginTop: 2, height: 4, background: 'var(--surface-inset)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, range.maxPercent)}%`, height: '100%', background: danger ? 'var(--danger)' : 'var(--safe)', opacity: 0.85 }} />
      </div>
    </div>
  );
}

/* ---------- the screen ---------- */

export function ArenaCalculatorLandscape({
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
  defenderExtra?: React.ReactNode;
  attackerExtra?: React.ReactNode;
}) {
  const [dir, setDir] = useState<Side>('p1');
  const [view, setView] = useState<'damage' | 'speed'>('damage');
  const [picker, setPicker] = useState<{ side: Side; field: CorePickerField } | null>(null);
  const [movePickerSide, setMovePickerSide] = useState<Side | null>(null);
  const [advancedSide, setAdvancedSide] = useState<Side | null>(null);
  const [showdownSide, setShowdownSide] = useState<Side | null>(null);

  const defDir: Side = dir === 'p1' ? 'p2' : 'p1';
  const nameOf = (id: number | null) => pokemonList.find((p) => p.id === id)?.nameEn ?? '—';
  const megaFor = (sideKey: Side) => {
    const target = megaCycleTarget(state[sideKey].selectedId, pokemonList);
    if (!target) return null;
    const isMega = /-mega(-[a-z]+)?$/.test(pokemonList.find((p) => p.id === state[sideKey].selectedId)?.identifier ?? '');
    return { label: isMega ? 'Unmega' : 'Mega', onClick: () => void actions.handleSwapForm(sideKey, target) };
  };
  const scenarios = useDamageScenarios(state, pokemonList, dir);
  const results = dir === 'p1' ? p1Results : p2Results;
  const atk = state[dir];
  const r = results[atk.activeMoveIndex] ?? null;
  const ko = koVerdictFromText(r?.koChanceText);
  const pct = r ? `${isNaN(r.minPercent) ? '0.0' : r.minPercent}–${isNaN(r.maxPercent) ? '0.0' : r.maxPercent}%` : '—';
  const dmg = r ? `${r.minDamage}–${r.maxDamage} dmg` : 'Pick a move';
  const activeMove = atk.moves[atk.activeMoveIndex] as MoveData | null;
  const activeMoveType = activeMove ? REVERSE_TYPE_IDS[r?.moveType ?? activeMove.typeId] : null;

  const speed = buildSpeedCompare(
    {
      baseSpe: state[dir].baseSpe, spSpe: state[dir].spSpe,
      nature: state[dir].nature,
      speStage: state[dir].stages.spe || 0, item: state[dir].item, isTailwind: state[dir].isTailwind,
    },
    { baseSpe: state[defDir].baseSpe, speStage: state[defDir].stages.spe || 0, isTailwind: state[defDir].isTailwind },
  );

  // Offensive/defensive stat that matters for the attacker's active move category:
  // physical → atk/def, special (or no move) → spa/spd. Mirrors the portrait build.
  const p1ActiveMove = state.p1.moves[state.p1.activeMoveIndex] as MoveData | null;
  const p1MoveIsPhysical = p1ActiveMove?.damageClassId === 2;
  const p1OffKey: keyof SideState = p1MoveIsPhysical ? 'spAtk' : 'spSpa';
  const p1OffLabel = p1MoveIsPhysical ? 'Atk SP' : 'SpA SP';
  const p1RankStat = p1MoveIsPhysical ? 'atk' : 'spa';
  const p2DefKey: keyof SideState = p1MoveIsPhysical ? 'spDef' : 'spSpd';
  const p2DefLabel = p1MoveIsPhysical ? 'Def SP' : 'SpD SP';
  const p2RankStat = p1MoveIsPhysical ? 'def' : 'spd';

  // Nature wheel: index 0 = hinder, 1 = neutral, 2 = boost, for one stat.
  const natIdx = (s: SideState, stat: string) => {
    const m = natureMultiplier(s.nature, stat);
    return m > 1 ? 2 : m < 1 ? 0 : 1;
  };
  const setNatureWheel = (side: Side, stat: string, target: number) => {
    if (target === natIdx(state[side], stat)) return;
    dispatch({ type: 'SET_NATURE', payload: { side, nature: natureForStatWheel(stat, target) } });
  };
  const stepHp = (delta: number) =>
    dispatch({ type: 'SET_HP_PERCENT', payload: { side: 'p2', val: Math.max(0, Math.min(100, state.p2.hpPercent + delta)) } });

  // Drag/scrub the defender HP bar → set HP% from pointer x within the bar.
  const hpBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const set = (clientX: number) => {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      dispatch({ type: 'SET_HP_PERCENT', payload: { side: 'p2', val: Math.round(ratio * 100) } });
    };
    set(e.clientX);
    const move = (ev: PointerEvent) => set(ev.clientX);
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const panelBase: React.CSSProperties = {
    width: 'clamp(224px, 30%, 280px)', flex: '0 0 auto',
    overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none',
    background: 'var(--surface-sticky)', padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 6,
  };
  const hpP = state.p2.hpPercent;

  return (
    <div style={{ display: 'flex', height: '100%', minWidth: 0, fontFamily: 'var(--font-ui)', color: 'var(--text-body)' }}>

      {/* -------- attacker (p1, left) -------- */}
      <div style={{ ...panelBase, borderRight: '1px solid var(--line-1)' }}>
        <SideHeader side={state.p1} name={nameOf(state.p1.selectedId)} tone="accent" badge="You" onOpenSpecies={() => setPicker({ side: 'p1', field: 'species' })} mega={megaFor('p1')} />

        {attackerExtra}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={microHdr}>Moves</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setMovePickerSide('p1')} aria-label="Edit attacker moves" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--ink-3)' }}>
              <Icon name="pencil" size={12} color="var(--ink-3)" />
            </button>
          </div>
          {state.p1.moves.map((m, i) => (
            <MoveRow
              key={i}
              move={m as MoveData | null}
              result={p1Results[i] ?? null}
              active={i === state.p1.activeMoveIndex}
              showBp
              onClick={() => (m ? dispatch({ type: 'SET_ACTIVE_MOVE_SLOT', payload: { side: 'p1', index: i } }) : setMovePickerSide('p1'))}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 5 }}>
          <WheelPicker label="Nature" options={NATURE_OPTIONS} active={natIdx(state.p1, p1RankStat) !== 1}
            index={natIdx(state.p1, p1RankStat)} onChange={(i) => setNatureWheel('p1', p1RankStat, i)} />
          <WheelPicker label={p1OffLabel} options={SP_OPTIONS} active={(state.p1[p1OffKey] as number) > 0}
            index={state.p1[p1OffKey] as number}
            onChange={(i) => dispatch({ type: 'SET_SP', payload: { side: 'p1', key: p1OffKey as string, val: i } })} />
          <WheelPicker label="Rank" options={RANK_OPTIONS} active={(state.p1.stages[p1RankStat] || 0) !== 0}
            index={(state.p1.stages[p1RankStat] || 0) + 6}
            onChange={(i) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: 'p1', stat: p1RankStat, val: i - 6 } })} />
        </div>

        <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
          <MetaPill icon="sparkles" label={state.p1.activeAbility ?? 'Ability'} onClick={() => setPicker({ side: 'p1', field: 'ability' })} />
          <MetaPill icon="shield" label={state.p1.item ?? 'Item'} onClick={() => setPicker({ side: 'p1', field: 'item' })} />
        </div>

        <span style={{ flex: 1 }} />
        <button style={addBtn} onClick={() => setAdvancedSide('p1')}>
          <Icon name="plus" size={12} color="var(--ink-3)" />
          Add item · ability · weather…
        </button>
      </div>

      {/* -------- center: result column -------- */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', gap: 2, padding: 2, background: 'var(--surface-inset)', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-1)' }}>
            {(['damage', 'speed'] as const).map((v) => {
              const on = view === v;
              return (
                <button key={v} onClick={() => setView(v)} style={{
                  flex: 1, padding: '4px 0', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  border: `1px solid ${on ? 'var(--accent-soft-line)' : 'transparent'}`,
                  fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 700,
                  color: on ? 'var(--accent)' : 'var(--ink-3)',
                }}>
                  {v === 'damage' ? 'Damage' : 'Speed'}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setDir((d) => (d === 'p1' ? 'p2' : 'p1'))}
            aria-label="Swap direction"
            title="Swap sides"
            style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', cursor: 'pointer' }}
          >
            <Icon name="arrow-left-right" size={13} color="var(--ink-2)" />
          </button>
        </div>

        {view === 'damage' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {activeMoveType && <TypeBadge type={activeMoveType} size="sm" />}
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r?.moveName ?? activeMove?.nameEn ?? 'No move'}
              </span>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'flex', flex: 'none', border: '1px solid var(--line-1)', borderRadius: 999, overflow: 'hidden', background: 'var(--surface-inset)' }}>
                {([['Single', false], ['Spread', true]] as const).map(([label, spread]) => {
                  const on = state.isSpreadTarget === spread;
                  return (
                    <button key={label} type="button" onClick={() => dispatch({ type: 'SET_SPREAD_TARGET', payload: spread })}
                      style={{ padding: '2px 9px', cursor: 'pointer', border: 'none', fontFamily: 'var(--font-ui)', fontSize: 9.5, fontWeight: 700, lineHeight: 1.7, whiteSpace: 'nowrap', background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: 'var(--ls-readout)', lineHeight: 1 }}>{pct}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 }}>
                <span>{dmg}</span> · <span style={{ color: 'var(--ink-1)' }}>{nameOf(state[dir].selectedId)}</span> vs <span style={{ color: 'var(--ink-1)' }}>{nameOf(state[defDir].selectedId)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <KOVerdict verdict={ko.verdict} confidence={ko.confidence} tone={ko.tone} />
            </div>

            {r && (
              <div style={{ height: 7, background: 'var(--surface-inset)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${Math.min(100, r.minPercent)}%`, background: 'var(--danger)' }} />
                <div style={{ width: `${Math.min(100, r.maxPercent) - Math.min(100, r.minPercent)}%`, background: 'var(--danger-soft)', borderLeft: '1px solid var(--danger-line)' }} />
              </div>
            )}

            {(scenarios.crit || scenarios.maxBulk || scenarios.noSp) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <ScenarioRow label="Crit" range={scenarios.crit} />
                <ScenarioRow label="Opp. max bulk" range={scenarios.maxBulk} />
                <ScenarioRow label="Opp. no SP" range={scenarios.noSp} />
              </div>
            )}

            <ArenaBattlefieldRow state={state} dispatch={dispatch} />
          </>
        ) : (
          <ArenaSpeedCompareView
            compare={speed}
            layout="columns"
            youName={nameOf(state[dir].selectedId)}
            oppName={nameOf(state[defDir].selectedId)}
            oppBaseSpe={state[defDir].baseSpe}
            youStage={state[dir].stages.spe || 0}
            oppStage={state[defDir].stages.spe || 0}
            onYouStage={(val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: dir, stat: 'spe', val } })}
            onOppStage={(val) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: defDir, stat: 'spe', val } })}
            youSpeSp={state[dir].spSpe}
            onYouSpeSp={(i) => dispatch({ type: 'SET_SP', payload: { side: dir, key: 'spSpe', val: i } })}
            formula={speedFormula(state[dir])}
            trickRoom={state.isTrickRoom}
          />
        )}
      </div>

      {/* -------- defender (p2, right) -------- */}
      <div style={{
        ...panelBase,
        width: 'calc(clamp(224px, 30%, 280px) + var(--safe-right, 0px))',
        marginRight: 'calc(-1 * var(--safe-right, 0px))',
        padding: '8px calc(10px + var(--safe-right, 0px)) 8px 10px',
        borderLeft: '1px solid var(--line-1)',
      }}>
        <SideHeader side={state.p2} name={nameOf(state.p2.selectedId)} tone="danger" badge="Opp" onOpenSpecies={() => setPicker({ side: 'p2', field: 'species' })} mega={megaFor('p2')} />

        {onOpenScan && (
          <button onClick={onOpenScan} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 24, borderRadius: 8, background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: 'var(--danger)', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            <Icon name="scan-line" size={12} color="var(--danger)" />
            Scan opponent team
          </button>
        )}

        {defenderExtra}

        {/* HP: draggable bar + numeric input + steppers */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...microHdr, flex: 'none' }}>HP</span>
            <div onPointerDown={hpBarDown} style={{ flex: 1, height: 11, background: 'var(--surface-inset)', borderRadius: 999, overflow: 'hidden', cursor: 'ew-resize', touchAction: 'none' }}>
              <div style={{ width: `${hpP}%`, height: '100%', background: hpP > 30 ? 'var(--safe)' : 'var(--danger)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', minWidth: 34, textAlign: 'right' }}>{hpP}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <input
              aria-label="Defender HP percent"
              type="number" min={0} max={100} value={hpP}
              onChange={(e) => dispatch({ type: 'SET_HP_PERCENT', payload: { side: 'p2', val: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } })}
              style={{ width: 52, padding: '3px 6px', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--ink-1)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-4)' }}>%</span>
            <span style={{ flex: 1 }} />
            <button aria-label="Lower defender HP" onClick={() => stepHp(-1)} style={microBtn}>−</button>
            <button aria-label="Raise defender HP" onClick={() => stepHp(1)} style={microBtn}>+</button>
          </div>
        </div>

        {/* defender active move (opens move picker; matters when sides are swapped) */}
        <MoveRow
          move={state.p2.moves[state.p2.activeMoveIndex] as MoveData | null}
          result={p2Results[state.p2.activeMoveIndex] ?? null}
          active={dir === 'p2'}
          onClick={() => setMovePickerSide('p2')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          <WheelPicker label="Nature" options={NATURE_OPTIONS} active={natIdx(state.p2, p2RankStat) !== 1}
            index={natIdx(state.p2, p2RankStat)} onChange={(i) => setNatureWheel('p2', p2RankStat, i)} />
          <WheelPicker label="HP SP" options={SP_OPTIONS} active={state.p2.spHp > 0}
            index={state.p2.spHp}
            onChange={(i) => dispatch({ type: 'SET_SP', payload: { side: 'p2', key: 'spHp', val: i } })} />
          <WheelPicker label={p2DefLabel} options={SP_OPTIONS} active={(state.p2[p2DefKey] as number) > 0}
            index={state.p2[p2DefKey] as number}
            onChange={(i) => dispatch({ type: 'SET_SP', payload: { side: 'p2', key: p2DefKey as string, val: i } })} />
          <WheelPicker label="Rank" options={RANK_OPTIONS} active={(state.p2.stages[p2RankStat] || 0) !== 0}
            index={(state.p2.stages[p2RankStat] || 0) + 6}
            onChange={(i) => dispatch({ type: 'SET_STAT_STAGE', payload: { side: 'p2', stat: p2RankStat, val: i - 6 } })} />
        </div>

        <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
          <MetaPill icon="sparkles" label={state.p2.activeAbility ?? 'Ability'} onClick={() => setPicker({ side: 'p2', field: 'ability' })} />
          <MetaPill icon="shield" label={state.p2.item ?? 'Item'} onClick={() => setPicker({ side: 'p2', field: 'item' })} />
        </div>

        <span style={{ flex: 1 }} />
        <button style={addBtn} onClick={() => setAdvancedSide('p2')}>
          <Icon name="plus" size={12} color="var(--ink-3)" />
          Add item · screen · hazard…
        </button>
      </div>

      {/* -------- sheets (same wiring as portrait) -------- */}
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
      <ArenaMovePickerSheet
        open={!!movePickerSide}
        side={movePickerSide ?? 'p1'}
        onClose={() => setMovePickerSide(null)}
        state={state}
        dispatch={dispatch}
        moveList={moveList}
        results={movePickerSide === 'p2' ? p2Results : p1Results}
      />
      <ArenaPickerSheet
        picker={picker}
        onClose={() => setPicker(null)}
        state={state}
        dispatch={dispatch}
        pokemonList={pokemonList}
        actions={actions}
        autoFocus={false}
      />
      <ShowdownImportModal
        isOpen={!!showdownSide}
        onClose={() => setShowdownSide(null)}
        onImport={(set) => { if (showdownSide) actions.handleImportShowdown(showdownSide, set); setShowdownSide(null); }}
      />
    </div>
  );
}
