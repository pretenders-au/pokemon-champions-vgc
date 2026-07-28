// Team-preview confirm panel (window state 'panel'), styled after the
// TeamScan confirm design: detected-team grid left, fix-detection panel
// right, pinned Confirm & save footer. Parent remounts (key) per scan.
import React, { useMemo, useState } from 'react';
import PokemonImage from '@/components/atoms/PokemonImage';
import { seedRoster, updateEntryId, availableCandidatesFor, unavailableIdsFor, opponentIdsFromEntries, LOW_CONFIDENCE, type ScanEntry } from '@/features/scan/roster';
import { Icon } from '@/design-system/arena';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { SlotResult } from '../scan/types';

interface ConfirmRosterViewProps {
  slots: SlotResult[];
  pokemonList: PokemonBaseStats[];
  onConfirm: (ids: number[]) => void;
  onRescan: () => void;
  onClose: () => void;
}

const micro: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)',
};
const pct = (score: number) => `${Math.max(0, Math.min(99, Math.round(score * 100)))}%`;

const ConfirmRosterView: React.FC<ConfirmRosterViewProps> = ({ slots, pokemonList, onConfirm, onRescan, onClose }) => {
  // The design shows exactly the six team-preview slots; drop scanner noise.
  const shown = useMemo(() => slots.slice(0, 6), [slots]);
  const byId = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);
  const [entries, setEntries] = useState<ScanEntry[]>(() => seedRoster(shown));
  // Pre-select the least-confident slot for review, like the design.
  const [fixing, setFixing] = useState<number>(() => {
    let idx = 0;
    let min = Infinity;
    shown.forEach((s, i) => { const sc = s.candidates[0]?.score ?? -1; if (sc < min) { min = sc; idx = i; } });
    return idx;
  });
  const [query, setQuery] = useState('');

  const nameOf = (id: number | null) => (id == null ? 'Unknown' : byId.get(id)?.nameEn ?? `#${id}`);
  const setPick = (slotIdx: number, id: number) => setEntries((prev) => updateEntryId(prev, slotIdx, id));
  const ids = opponentIdsFromEntries(entries);

  // Live dex matches while typing: startsWith hits first, then contains.
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    const taken = unavailableIdsFor(entries, fixing);
    const starts: PokemonBaseStats[] = [];
    const contains: PokemonBaseStats[] = [];
    for (const p of pokemonList) {
      if (taken.has(p.id)) continue;
      const en = p.nameEn.toLowerCase();
      if (en.startsWith(q)) starts.push(p);
      else if (en.includes(q) || (p.nameZh ?? '').includes(query.trim()) || p.identifier.includes(q)) contains.push(p);
    }
    return [...starts, ...contains].slice(0, 12);
  }, [q, query, pokemonList, entries, fixing]);

  const pickAndClear = (id: number) => { setPick(fixing, id); setQuery(''); };
  const applyTyped = () => { if (matches.length > 0) pickAndClear(matches[0].id); };

  const slotState = (i: number) => {
    const entry = entries[i];
    // Score the candidate actually selected, not the raw top one: a slot re-picked by the
    // uniqueness assignment must still be flagged if that replacement is a weak read.
    const chosen = entry.candidates.find((c) => c.id === entry.id) ?? entry.candidates[0];
    const manual = entry.id != null && !entry.candidates.some((c) => c.id === entry.id);
    const low = !manual && (chosen?.score ?? 0) < LOW_CONFIDENCE;
    return { manual, low, chosen };
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)' }}>
      {/* chrome bar (overlay variant: no nav rail / stepper) */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', borderBottom: '1px solid var(--line-1)' }}>
        <Icon name="scan-line" size={15} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>Confirm opponent roster</span>
        <span style={{ flex: 1 }} />
        <button aria-label="Re-scan team" onClick={onRescan} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          <Icon name="rotate-ccw" size={12} color="var(--ink-2)" />Re-scan team
        </button>
        <button
          disabled={ids.length === 0}
          onClick={() => onConfirm(ids)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none',
            cursor: ids.length === 0 ? 'default' : 'pointer', fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
            color: 'var(--navy-900)', background: 'var(--accent)', opacity: ids.length === 0 ? 0.4 : 1,
          }}
        >
          <Icon name="check" size={13} color="var(--navy-900)" />Confirm &amp; save
        </button>
        <button aria-label="Minimize" onClick={onClose} style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', cursor: 'pointer' }}>
          <Icon name="chevron-down" size={14} color="var(--ink-2)" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '12px 14px' }}>
        {/* Each column scrolls on its own — reviewing candidates on the right
            must not move the detected-team grid on the left. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, height: '100%', minHeight: 0 }}>
          {/* LEFT: detected team */}
          <div className="ac-scroll" style={{ overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <div style={micro}>Detected team</div>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>Tap a card to review</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {shown.map((s, i) => {
                const { manual, low, chosen } = slotState(i);
                const sel = fixing === i;
                return (
                  <button
                    key={i}
                    aria-label={`Fix ${nameOf(entries[i].id)}`}
                    onClick={() => setFixing(i)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2, padding: 8, borderRadius: 'var(--r-md)', cursor: 'pointer',
                      background: sel ? 'var(--accent-soft)' : 'var(--surface-card)',
                      border: `1px solid ${sel ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                        color: low ? 'var(--field)' : manual ? 'var(--accent)' : 'var(--safe)',
                        background: low ? 'var(--field-soft)' : manual ? 'var(--accent-soft)' : 'var(--safe-soft)',
                        border: `1px solid ${low ? 'var(--field-line)' : manual ? 'var(--accent-soft-line)' : 'var(--safe-line)'}`,
                      }}>
                        {manual ? 'Set' : chosen ? pct(chosen.score) : '—'}
                      </span>
                      <Icon name={low ? 'alert-triangle' : 'check'} size={13} color={low ? 'var(--field)' : 'var(--safe)'} />
                    </div>
                    <div style={{ width: '100%', height: 52, display: 'grid', placeItems: 'center', margin: '2px 0' }}>
                      {entries[i].id != null && <PokemonImage id={entries[i].id!} name={nameOf(entries[i].id)} className="w-12 h-12" />}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                      {nameOf(entries[i].id)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: fix detection */}
          <div className="ac-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="replace" size={15} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Fix detection</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 10.5, fontWeight: 700, color: 'var(--field)', background: 'var(--field-soft)', border: '1px solid var(--field-line)', borderRadius: 999, padding: '2px 8px' }}>
                Slot {fixing + 1}
              </span>
            </div>
            <div style={{ ...micro, marginTop: 2 }}>Or type a name</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyTyped(); }}
                placeholder="Amoonguss…"
                aria-label="Type a name"
                style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, outline: 'none' }}
              />
              <button aria-label="Apply" onClick={applyTyped} style={{ flex: 'none', padding: '0 13px', minHeight: 36, borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Apply
              </button>
            </div>
            {q ? (
              <>
                <div style={micro}>Matches</div>
                <div className="ac-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 190, overflowY: 'auto' }}>
                  {matches.map((p) => {
                    const on = entries[fixing].id === p.id;
                    return (
                      <button
                        key={p.id}
                        aria-label={`Use ${p.nameEn}`}
                        onClick={() => pickAndClear(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                          background: on ? 'var(--accent-soft)' : 'var(--surface-inset)',
                          border: `1px solid ${on ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
                        }}
                      >
                        <span style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                          <PokemonImage id={p.id} name={p.nameEn} className="w-8 h-8" />
                        </span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'left' }}>{p.nameEn}</span>
                      </button>
                    );
                  })}
                  {matches.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '6px 2px' }}>No Pokémon match “{query.trim()}”</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={micro}>Top candidates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availableCandidatesFor(entries, fixing).slice(0, 3).map((c) => {
                    const on = entries[fixing].id === c.id;
                    return (
                      <button
                        key={c.id}
                        aria-label={`Use ${nameOf(c.id)}`}
                        onClick={() => setPick(fixing, c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                          background: on ? 'var(--accent-soft)' : 'var(--surface-inset)',
                          border: `1px solid ${on ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
                        }}
                      >
                        <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'grid', placeItems: 'center', border: `2px solid ${on ? 'var(--accent)' : 'var(--line-3)'}` }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent)' : 'transparent' }} />
                        </span>
                        <span style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                          <PokemonImage id={c.id} name={nameOf(c.id)} className="w-8 h-8" />
                        </span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'left' }}>{nameOf(c.id)}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: c.score >= 0.6 ? 'var(--safe)' : c.score >= 0.2 ? 'var(--field)' : 'var(--ink-4)' }}>{pct(c.score)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 'auto', padding: '9px 10px', borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)' }}>
              <Icon name="shield-check" size={14} color="var(--accent)" />
              <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.35 }}>
                Saving locks these 6 species — future in-battle scans match only them.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRosterView;
