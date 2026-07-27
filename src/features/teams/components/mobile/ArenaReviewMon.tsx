import React, { useState, useMemo, useEffect } from 'react';
import { Icon, Sprite, TypeBadge } from '@/design-system/arena';
import type { TeamWithMembers } from '@/db/repositories/team.repo';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import { championsHP, championsStat } from '@/features/pokemon/utils/champions-stats';
import { convertSpToEv } from '@/features/pokemon/utils/sp-ev-converter';
import { getNatureFromStats, getNatureStats, natureMultiplier, natureForStatWheel } from '@/features/pokemon/utils/pokemon-natures';
import { formatShowdownSet } from '@/features/pokemon/utils/showdown-formatter';
import { REVERSE_TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import ItemSearchSelect from '@/components/molecules/ItemSearchSelect';
import ItemImage from '@/components/atoms/ItemImage';
import { useViewportMode } from '@/hooks/useViewportMode';

export interface ArenaReviewMonProps {
  member: TeamWithMembers['members'][number];
  teamName: string;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  onBack: () => void;
  onSave: (config: PokemonConfig) => void;
  onSendToCalc?: () => void;
  saveLabel?: string;
  /** Optional content rendered directly under the header — e.g. the scan flow's species-correction band. */
  banner?: React.ReactNode;
}

const STATS: { key: string; label: string; short: string; ev: string; baseKey: keyof PokemonConfig; spKey: keyof PokemonConfig }[] = [
  { key: 'hp', label: 'HP', short: 'H', ev: 'HP', baseKey: 'baseHp', spKey: 'spHp' },
  { key: 'atk', label: 'Atk', short: 'A', ev: 'Atk', baseKey: 'baseAtk', spKey: 'spAtk' },
  { key: 'def', label: 'Def', short: 'B', ev: 'Def', baseKey: 'baseDef', spKey: 'spDef' },
  { key: 'spa', label: 'SpA', short: 'C', ev: 'SpA', baseKey: 'baseSpa', spKey: 'spSpa' },
  { key: 'spd', label: 'SpD', short: 'D', ev: 'SpD', baseKey: 'baseSpd', spKey: 'spSpd' },
  { key: 'spe', label: 'Spe', short: 'S', ev: 'Spe', baseKey: 'baseSpe', spKey: 'spSpe' },
];
const SP_MAX = 32;

const micro: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)' };
const textInput: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '7px 10px', background: 'var(--surface-inset)', border: '1px solid var(--line-2)',
  borderRadius: 'var(--r-sm)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, outline: 'none',
};
const footerBtn = (primary: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: primary ? '0 17px' : '0 13px', flex: 'none',
  borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: primary ? 13 : 12, fontWeight: 700, whiteSpace: 'nowrap',
  background: primary ? 'var(--accent)' : 'var(--surface-inset)', border: primary ? 'none' : '1px solid var(--line-2)',
  color: primary ? '#0a0f1a' : 'var(--ink-2)',
});

/**
 * MoveField — app-styled move autocomplete replacing the native <datalist>
 * (which renders unreadably, especially in dark theme). Shows the current move,
 * filters as you type, and opens a token-styled dropdown like the ability picker.
 */
const MoveField: React.FC<{ index: number; value: MoveData | null; moveList: MoveData[]; onSelect: (m: MoveData | null) => void }> = ({ index, value, moveList, onSelect }) => {
  const [text, setText] = useState(value?.nameEn ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { setText(value?.nameEn ?? ''); }, [value]);

  const type = value ? (REVERSE_TYPE_IDS[value.typeId] ?? 'normal') : null;
  const results = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return moveList.filter((m) => m.nameEn.toLowerCase().includes(t) || (m.nameZh && m.nameZh.includes(text.trim()))).slice(0, 12);
  }, [text, moveList]);

  const commit = (m: MoveData) => { onSelect(m); setText(m.nameEn); setOpen(false); };
  const close = () => { setOpen(false); setText(value?.nameEn ?? ''); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 16, height: 16, flex: 'none', borderRadius: 5, background: type ? `var(--type-${type})` : 'var(--line-2)' }} />
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input
          type="text"
          value={text}
          placeholder={`Move ${index + 1}`}
          onChange={(e) => { const v = e.target.value; setText(v); setOpen(true); setActive(0); if (!v.trim()) onSelect(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((p) => (p + 1) % results.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((p) => (p - 1 + results.length) % results.length); }
            else if (e.key === 'Enter') { e.preventDefault(); commit(results[active] ?? results[0]); }
            else if (e.key === 'Escape') close();
          }}
          style={{ ...textInput, width: '100%' }}
        />
        {open && results.length > 0 && (
          <>
            <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
            <div style={{ position: 'absolute', [index >= 2 ? 'bottom' : 'top']: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: 'var(--surface-card)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-pop)', maxHeight: 208, overflowY: 'auto', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {results.map((m, i) => {
                const rt = REVERSE_TYPE_IDS[m.typeId] ?? 'normal';
                const on = i === active;
                return (
                  <button key={m.id} type="button" onMouseDown={(e) => { e.preventDefault(); commit(m); }} onMouseEnter={() => setActive(i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 'var(--r-sm)', background: on ? 'var(--accent-soft)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)' }}>
                    <span style={{ width: 10, height: 10, flex: 'none', borderRadius: 3, background: `var(--type-${rt})` }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: on ? 'var(--accent)' : 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nameEn}</span>
                    <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--ink-4)' }}>{m.damageClassId === 2 ? 'Phys' : m.damageClassId === 3 ? 'Spec' : 'Status'}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * ArenaReviewMon — the per-Pokémon "Review & save" screen (Turn 3c of the Arena
 * design). Stats and moves merge into one editable profile: moves / ability /
 * item on the left, derived stats with editable SP on the right. Tap a stat to
 * cycle its nature (boost / lower). EVs are auto-derived for Showdown export.
 *
 * Note: the app uses Champions SP (0–32) via championsStat — the same numbers
 * the calculator shows — rather than the mock's raw 0–252 EVs.
 */
export const ArenaReviewMon: React.FC<ArenaReviewMonProps> = ({ member, teamName, pokemonList, moveList, onBack, onSave, onSendToCalc, saveLabel, banner }) => {
  const c = member.configuration;
  const portrait = useViewportMode() === 'arena';
  const species = pokemonList.find((p) => p.id === c.selectedId);
  const [sp, setSp] = useState<Record<string, number>>({
    spHp: c.spHp, spAtk: c.spAtk, spDef: c.spDef, spSpa: c.spSpa, spSpd: c.spSpd, spSpe: c.spSpe,
  });
  const [up, setUp] = useState<string | null>(c.boostedStat);
  const [down, setDown] = useState<string | null>(c.hinderedStat);
  const [item, setItem] = useState(c.item ?? '');
  const [ability, setAbility] = useState(c.activeAbility ?? '');
  const [moves, setMoves] = useState<(MoveData | null)[]>([0, 1, 2, 3].map((i) => c.moves[i] ?? null));
  const [isAbilityOpen, setIsAbilityOpen] = useState(false);
  const [hoveredAbilityIndex, setHoveredAbilityIndex] = useState<number | null>(null);

  const setSpVal = (spKey: string, v: number) => {
    const targetVal = Math.max(0, Math.min(SP_MAX, v || 0));
    const currentTotalWithoutThis = STATS.reduce((sum, s) => {
      if (s.spKey === spKey) return sum;
      return sum + sp[s.spKey as string];
    }, 0);
    const maxAllowed = Math.max(0, 66 - currentTotalWithoutThis);
    const cappedVal = Math.min(targetVal, maxAllowed);
    setSp((prev) => ({ ...prev, [spKey]: cappedVal }));
  };
  // A lone boost is not a nature: read the multiplier off the nature these two resolve to,
  // so the displayed stat matches what the damage engine will compute.
  const natMult = (key: string) => natureMultiplier(getNatureFromStats(up, down), key);
  const valueFor = (key: string, baseKey: keyof PokemonConfig, spKey: keyof PokemonConfig) => {
    const base = c[baseKey] as number;
    return key === 'hp' ? championsHP(base, sp[spKey as string]) : championsStat(base, sp[spKey as string], natMult(key));
  };
  // One button per stat, cycling neutral -> boost -> hinder -> neutral. Each position is a
  // real nature: natureForStatWheel pairs the tuned stat with the conventional dump stat,
  // so the button can never leave a half-set nature behind.
  const cycleNature = (key: string) => {
    if (key === 'hp') return;
    const current = up === key ? 2 : down === key ? 0 : 1;
    const next = current === 1 ? 2 : current === 2 ? 0 : 1;
    const { boostedStat, hinderedStat } = getNatureStats(natureForStatWheel(key, next));
    setUp(boostedStat);
    setDown(hinderedStat);
  };

  const buildConfig = (): PokemonConfig => ({
    ...c,
    spHp: sp.spHp, spAtk: sp.spAtk, spDef: sp.spDef, spSpa: sp.spSpa, spSpd: sp.spSpd, spSpe: sp.spSpe,
    boostedStat: up, hinderedStat: down, nature: getNatureFromStats(up, down),
    item: item.trim() || null, activeAbility: ability.trim() || null, moves,
  });

  const evParts = STATS.filter((s) => convertSpToEv(sp[s.spKey as string]) > 0).map((s) => `${convertSpToEv(sp[s.spKey as string])} ${s.ev}`);
  const evTotal = STATS.reduce((a, s) => a + convertSpToEv(sp[s.spKey as string]), 0);
  const spTotal = STATS.reduce((a, s) => a + sp[s.spKey as string], 0);

  const exportShowdown = () => {
    const text = formatShowdownSet(buildConfig(), species?.nameEn ?? 'Pokemon');
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)' }}>
      {/* header */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', borderBottom: '1px solid var(--line-1)' }}>
        <button onClick={onBack} aria-label="Back to team" style={{ width: 30, height: 30, flex: 'none', borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid var(--line-1)', color: 'var(--ink-2)', cursor: 'pointer' }}>
          <Icon name="chevron-right" size={16} color="var(--ink-2)" style={{ transform: 'scaleX(-1)' }} />
        </button>
        <div style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 'var(--r-md)', border: '2px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)', overflow: 'hidden' }}>
          <Sprite dex={c.selectedId} size={36} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{species?.nameEn ?? 'Unknown'}</div>
          {species && (
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <TypeBadge type={(species.type1 as string) || 'normal'} size="sm" />
              {species.type2 && <TypeBadge type={species.type2 as string} size="sm" />}
            </div>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 11px', borderRadius: 'var(--r-pill)', background: 'var(--safe-soft)', border: '1px solid var(--safe-line)' }}>
          <Icon name="scan-line" size={12} color="var(--safe)" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--safe)' }}>Stats + Moves merged</span>
        </span>
      </div>

      {banner}

      {/* body: moves | stats — side by side on landscape, stacked in portrait */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: portrait ? 'column' : 'row', overflowY: portrait ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
        {/* LEFT: moves · ability · item */}
        <div style={{ width: portrait ? '100%' : '48%', flex: 'none', overflowY: portrait ? 'visible' : 'auto', scrollbarWidth: 'none', borderRight: portrait ? 'none' : '1px solid var(--line-1)', borderBottom: portrait ? '1px solid var(--line-1)' : 'none', padding: '13px 15px' }}>
          <div style={{ ...micro, marginBottom: 11 }}>Moves · ability · item</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 58, flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>Held item</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {item && (
                  <div style={{ flex: 'none', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ItemImage name={item} className="w-6 h-6" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <ItemSearchSelect
                    label=""
                    selectedItem={item || null}
                    onSelect={(val) => setItem(val || '')}
                    hideClear
                  />
                </div>
                {item && (
                  <button
                    type="button"
                    onClick={() => setItem('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      flex: 'none',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 58, flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>Ability</span>
              <div style={{ flex: 1, position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsAbilityOpen(!isAbilityOpen)}
                  style={{
                    ...textInput,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    paddingRight: '30px',
                    position: 'relative',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ability || 'Select Ability'}
                  </span>
                  <Icon
                    name="chevron-down"
                    size={14}
                    color="var(--ink-3)"
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                </button>
                {isAbilityOpen && (
                  <>
                    <div
                      onClick={() => setIsAbilityOpen(false)}
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 90,
                        background: 'transparent',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 'var(--r-md)',
                        boxShadow: 'var(--shadow-pop)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      {(c.abilities && c.abilities.length > 0 ? c.abilities : [ability]).map((a, idx) => {
                        const isSelected = ability === a;
                        const isHovered = hoveredAbilityIndex === idx;
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => {
                              setAbility(a);
                              setIsAbilityOpen(false);
                            }}
                            onMouseEnter={() => setHoveredAbilityIndex(idx)}
                            onMouseLeave={() => setHoveredAbilityIndex(null)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 'var(--r-sm)',
                              background: isSelected
                                ? 'var(--accent-soft)'
                                : isHovered
                                ? 'var(--surface-inset)'
                                : 'transparent',
                              color: isSelected
                                ? 'var(--accent)'
                                : isHovered
                                ? 'var(--ink-1)'
                                : 'var(--ink-2)',
                              fontFamily: 'var(--font-ui)',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              textAlign: 'left',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              outline: 'none',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                          >
                            <span>{a}</span>
                            {isSelected && <Icon name="check" size={13} color="var(--accent)" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--line-1)', margin: '3px 0' }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Moves</div>
            {[0, 1, 2, 3].map((i) => (
              <MoveField
                key={i}
                index={i}
                value={moves[i]}
                moveList={moveList}
                onSelect={(m) => setMoves((prev) => prev.map((v, idx) => (idx === i ? m : v)))}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: stats + SP + auto EV */}
        <div style={{ width: portrait ? '100%' : undefined, flex: portrait ? 'none' : 1, minWidth: 0, overflowY: portrait ? 'visible' : 'auto', scrollbarWidth: 'none', padding: '13px 16px' }}>
          <div style={micro}>Stats</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-4)', margin: '5px 0 10px', lineHeight: 1.35 }}>Final stats are derived — edit the SP investment (type or slide).</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-1)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Nature</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)' }}>
              {(() => {
                const natStr = getNatureFromStats(up, down);
                if (!up || !down || up === down) return natStr;
                const match = natStr.match(/^([^(]+)\(\+([^,]+),\s*-([^)]+)\)$/);
                if (!match) return natStr;
                const [, name, boost, hinder] = match;
                return (
                  <>
                    {name.trim()}{' '}
                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>(</span>
                    <span style={{ color: 'var(--safe)' }}>+{boost}</span>
                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>, </span>
                    <span style={{ color: 'var(--danger)' }}>-{hinder}</span>
                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>)</span>
                  </>
                );
              })()}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>Tap a stat: ↑ boost / ↓ lower</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {STATS.map((s) => {
              const role = s.key === 'hp' ? 'none' : up === s.key ? 'up' : down === s.key ? 'down' : 'none';
              const arrow = role === 'up' ? ' ↑' : role === 'down' ? ' ↓' : '';
              const isH = s.key === 'hp';
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <button
                    onClick={() => cycleNature(s.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 26, flex: 'none', borderRadius: 6, cursor: isH ? 'default' : 'pointer', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                      background: role === 'up' ? 'var(--safe-soft)' : role === 'down' ? 'var(--danger-soft)' : 'var(--surface-inset)',
                      border: `1px solid ${role === 'up' ? 'var(--safe-line)' : role === 'down' ? 'var(--danger-line)' : 'var(--line-2)'}`,
                      color: role === 'up' ? 'var(--safe)' : role === 'down' ? 'var(--danger)' : (isH ? 'var(--ink-4)' : 'var(--ink-2)') }}
                  >{s.short}{arrow}</button>
                  <span style={{ width: 30, flex: 'none', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{valueFor(s.key, s.baseKey, s.spKey)}</span>
                  <input type="range" min={0} max={SP_MAX} value={sp[s.spKey as string]} onChange={(e) => setSpVal(s.spKey as string, Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <input value={sp[s.spKey as string]} onChange={(e) => setSpVal(s.spKey as string, Number(e.target.value))} inputMode="numeric" style={{ width: 46, flex: 'none', padding: '4px 6px', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--line-1)' }}>
            <span style={{ ...micro, letterSpacing: '0.04em' }}>SPs</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, fontWeight: 700, color: spTotal > 66 ? 'var(--danger)' : 'var(--ink-1)' }}>{spTotal} / 66</span>
          </div>
          <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <Icon name="scan-line" size={12} color="var(--accent)" />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent)' }}>Auto-calculated EVs</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.4 }}>{evParts.length ? evParts.join(' / ') : '0 EVs'}</div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', flexWrap: portrait ? 'wrap' : 'nowrap', justifyContent: portrait ? 'flex-end' : undefined, gap: 9, padding: '10px 16px', borderTop: '1px solid var(--line-1)', background: 'var(--surface-sticky)' }}>
        <span style={{ display: portrait ? 'none' : 'block', fontSize: 10.5, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamName} · ready to save.</span>
        <button onClick={exportShowdown} style={footerBtn(false)}><Icon name="clipboard-paste" size={15} color="var(--ink-2)" />Export Showdown</button>
        {onSendToCalc && <button onClick={onSendToCalc} style={footerBtn(false)}><Icon name="calculator" size={15} color="var(--ink-2)" />Send to calc</button>}
        <button onClick={() => onSave(buildConfig())} style={footerBtn(true)}><Icon name="check" size={16} color="#0a0f1a" />{saveLabel ?? 'Save to team'}</button>
      </div>
    </div>
  );
};
