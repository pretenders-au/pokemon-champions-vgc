// The scan-confirm design — detected-team card grid left, fix-detection panel
// right — extracted so its three hosts (the overlay panel, the /scan page, and
// the calculator's scan modal) render ONE component instead of three copies.
// Entry state stays with the host; this view owns only which slot is being
// fixed and the search query.
import React, { useMemo, useState } from 'react';
import PokemonImage from '@/components/atoms/PokemonImage';
import { Icon } from '@/design-system/arena';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { availableCandidatesFor, unavailableIdsFor, LOW_CONFIDENCE, type ScanEntry } from './roster';

export interface ScanConfirmViewProps {
  /** The host's FULL roster — uniqueness rules need every entry, even hidden ones. */
  entries: ScanEntry[];
  /** Roster indexes to display, in order (default: all). The grid caps at 6. */
  indexes?: number[];
  pokemonList: PokemonBaseStats[];
  onPick: (index: number, id: number) => void;
  /** compact = overlay / landscape page scale; roomy = desktop modal scale. */
  size?: 'compact' | 'roomy';
  /** Renders a "Re-scan team" button in the grid header. */
  onRescan?: () => void;
  /** Battle scans: show You/Opp badges and HP% on the cards. */
  showSides?: boolean;
  /** Host actions for the slot being fixed (set as defender, remove, …). */
  renderSlotActions?: (index: number) => React.ReactNode;
  /** Shows a "+ Add" card while fewer than 6 slots are displayed. */
  onAddSlot?: () => void;
}

const SIZES = {
  compact: { cardPad: 8, badgeFs: 11, imgCell: 52, imgCls: 'w-12 h-12', nameFs: 11.5, headFs: 13, headIcon: 15, rowNameFs: 12.5, inputFs: 12, micro: 10.5 },
  roomy: { cardPad: 10, badgeFs: 11.5, imgCell: 60, imgCls: 'w-14 h-14', nameFs: 12, headFs: 14, headIcon: 16, rowNameFs: 13, inputFs: 13, micro: 11 },
} as const;

/** The design shows exactly the six team-preview slots. Hosts that consume the
 *  roster (confirm/save/import) must apply the same cap — an entry the grid
 *  hides must never be silently confirmed. */
export const SCAN_CONFIRM_MAX_SLOTS = 6;

const pct = (score: number) => `${Math.max(0, Math.min(99, Math.round(score * 100)))}%`;

const ScanConfirmView: React.FC<ScanConfirmViewProps> = ({
  entries, indexes, pokemonList, onPick, size = 'compact', onRescan, showSides = false, renderSlotActions, onAddSlot,
}) => {
  const s = SIZES[size];
  const micro: React.CSSProperties = {
    fontSize: s.micro, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)',
  };
  const byId = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);
  const shown = useMemo(
    () => (indexes ?? entries.map((_, i) => i)).slice(0, SCAN_CONFIRM_MAX_SLOTS),
    [indexes, entries],
  );

  // The slot under review: the user's explicit card pick wins; otherwise the
  // least-confident displayed slot. Derived (not frozen at mount) because hosts
  // may seed entries after this view mounts, and re-deriving after a fix
  // advances review to the next doubtful slot.
  const [picked, setPicked] = useState<number | null>(null);
  // An index-based pick can't survive the roster growing or shrinking — snap
  // back to the derived slot when the entry count changes. This is what makes
  // Remove safe (indexes shift down) and +Add focus the new empty slot.
  const [seenCount, setSeenCount] = useState(entries.length);
  if (entries.length !== seenCount) { setSeenCount(entries.length); setPicked(null); }
  const derived = useMemo(() => {
    let idx = shown[0] ?? 0;
    let min = Infinity;
    for (const i of shown) {
      const e = entries[i];
      // Empty slots need attention most; a manual (searched) pick is
      // human-confirmed and needs it least; scanner reads rank between the
      // two by their confidence.
      const sc = e == null || e.id == null
        ? -1
        : e.candidates.find((c) => c.id === e.id)?.score ?? Infinity;
      if (sc < min) { min = sc; idx = i; }
    }
    return idx;
  }, [shown, entries]);
  const fixing = picked != null && shown.includes(picked) ? picked : derived;
  const setFixing = setPicked;
  const [query, setQuery] = useState('');

  const nameOf = (id: number | null) => (id == null ? '—' : byId.get(id)?.nameEn ?? `#${id}`);
  const fixingEntry = entries[fixing] as ScanEntry | undefined;
  const fixingPos = shown.indexOf(fixing); // 1-based display position for the Slot pill

  const slotState = (entry: ScanEntry) => {
    // Score the candidate actually selected, not the raw top one: a slot re-picked by the
    // uniqueness assignment must still be flagged if that replacement is a weak read.
    const chosen = entry.candidates.find((c) => c.id === entry.id) ?? entry.candidates[0];
    const manual = entry.id != null && !entry.candidates.some((c) => c.id === entry.id);
    const low = !manual && (chosen?.score ?? 0) < LOW_CONFIDENCE;
    return { manual, low, chosen };
  };

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

  const pickAndClear = (id: number) => { onPick(fixing, id); setQuery(''); };
  const applyTyped = () => { if (matches.length > 0) pickAndClear(matches[0].id); };

  const rowBtn = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '6px 10px',
    borderRadius: 'var(--r-sm)', cursor: 'pointer',
    background: on ? 'var(--accent-soft)' : 'var(--surface-inset)',
    border: `1px solid ${on ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, height: '100%', minHeight: 0, fontFamily: 'var(--font-ui)', color: 'var(--text-body)' }}>
      {/* LEFT: detected team */}
      <div className="ac-scroll" style={{ overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <div style={micro}>Detected team</div>
          <span style={{ fontSize: s.micro, color: 'var(--ink-4)' }}>Tap a card to review</span>
          <span style={{ flex: 1 }} />
          {onRescan && (
            <button
              onClick={onRescan}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)',
                fontFamily: 'var(--font-ui)', fontSize: s.micro + 0.5, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              <Icon name="rotate-ccw" size={12} color="var(--ink-2)" />Re-scan team
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {shown.map((i) => {
            const entry = entries[i];
            if (!entry) return null;
            const { manual, low, chosen } = slotState(entry);
            const sel = fixing === i;
            const empty = entry.id == null;
            const fg = empty || low ? 'var(--field)' : manual ? 'var(--accent)' : 'var(--safe)';
            const bg = empty || low ? 'var(--field-soft)' : manual ? 'var(--accent-soft)' : 'var(--safe-soft)';
            const line = empty || low ? 'var(--field-line)' : manual ? 'var(--accent-soft-line)' : 'var(--safe-line)';
            return (
              <button
                key={i}
                aria-label={`Fix ${nameOf(entry.id)}`}
                onClick={() => { setFixing(i); setQuery(''); }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2, padding: s.cardPad, borderRadius: 'var(--r-md)', cursor: 'pointer',
                  background: sel ? 'var(--accent-soft)' : 'var(--surface-card)',
                  border: `1px solid ${sel ? 'var(--accent-soft-line)' : 'var(--line-1)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {showSides && entry.side && (
                      <span style={{
                        fontSize: s.micro, padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                        color: entry.side === 'player' ? 'var(--accent)' : 'var(--danger)',
                        background: entry.side === 'player' ? 'var(--accent-soft)' : 'var(--danger-soft)',
                      }}>
                        {entry.side === 'player' ? 'You' : 'Opp'}
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: s.badgeFs, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: fg, background: bg, border: `1px solid ${line}` }}>
                      {empty ? '—' : manual ? 'Set' : chosen ? pct(chosen.score) : '—'}
                    </span>
                  </span>
                  <Icon name={empty || low ? 'alert-triangle' : 'check'} size={13} color={fg} />
                </div>
                <div style={{ width: '100%', height: s.imgCell, display: 'grid', placeItems: 'center', margin: '2px 0' }}>
                  {entry.id != null
                    ? <PokemonImage id={entry.id} name={nameOf(entry.id)} className={s.imgCls} />
                    : <div style={{ width: s.imgCell - 2, height: s.imgCell - 2, borderRadius: 8, background: 'var(--surface-inset)' }} />}
                </div>
                <div style={{ fontSize: s.nameFs, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {nameOf(entry.id)}
                  {showSides && entry.hpPercent != null && (
                    <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> · {entry.hpPercent}% HP</span>
                  )}
                </div>
              </button>
            );
          })}
          {onAddSlot && shown.length < 6 && (
            <button
              aria-label="Add Pokémon"
              onClick={onAddSlot}
              style={{
                minHeight: s.imgCell + 44, borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: '1px dashed var(--line-2)', background: 'transparent', color: 'var(--ink-3)',
                fontFamily: 'var(--font-ui)', fontSize: s.nameFs, fontWeight: 700,
              }}
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: fix detection */}
      <div className="ac-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="replace" size={s.headIcon} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: s.headFs, fontWeight: 700, color: 'var(--ink-1)' }}>Fix detection</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: s.micro, fontWeight: 700, color: 'var(--field)', background: 'var(--field-soft)', border: '1px solid var(--field-line)', borderRadius: 999, padding: '2px 8px' }}>
            Slot {(fixingPos === -1 ? 0 : fixingPos) + 1}
          </span>
        </div>
        {renderSlotActions && fixingEntry && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{renderSlotActions(fixing)}</div>
        )}
        {q ? (
          <>
            <div style={micro}>Matches</div>
            <div className="ac-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 190, overflowY: 'auto' }}>
              {matches.map((p) => (
                <button key={p.id} aria-label={`Use ${p.nameEn}`} onClick={() => pickAndClear(p.id)} style={rowBtn(fixingEntry?.id === p.id)}>
                  <span style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                    <PokemonImage id={p.id} name={p.nameEn} className="w-8 h-8" />
                  </span>
                  <span style={{ flex: 1, fontSize: s.rowNameFs, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'left' }}>{p.nameEn}</span>
                </button>
              ))}
              {matches.length === 0 && (
                <div style={{ fontSize: s.micro + 0.5, color: 'var(--ink-4)', padding: '6px 2px' }}>No Pokémon match “{query.trim()}”</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={micro}>Top candidates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {availableCandidatesFor(entries, fixing).slice(0, 3).map((c) => {
                const on = fixingEntry?.id === c.id;
                return (
                  <button key={c.id} aria-label={`Use ${nameOf(c.id)}`} onClick={() => onPick(fixing, c.id)} style={rowBtn(on)}>
                    <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'grid', placeItems: 'center', border: `2px solid ${on ? 'var(--accent)' : 'var(--line-3)'}` }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent)' : 'transparent' }} />
                    </span>
                    <span style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                      <PokemonImage id={c.id} name={nameOf(c.id)} className="w-8 h-8" />
                    </span>
                    <span style={{ flex: 1, fontSize: s.rowNameFs, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'left' }}>{nameOf(c.id)}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: c.score >= 0.6 ? 'var(--safe)' : c.score >= 0.2 ? 'var(--field)' : 'var(--ink-4)' }}>{pct(c.score)}</span>
                  </button>
                );
              })}
              {availableCandidatesFor(entries, fixing).length === 0 && (
                <div style={{ fontSize: s.micro + 1, color: 'var(--ink-4)' }}>No suggestions — type a name below.</div>
              )}
            </div>
          </>
        )}
        <div style={{ ...micro, marginTop: 2 }}>Or type a name</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyTyped(); }}
            placeholder="Amoonguss…"
            aria-label="Type a name"
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: s.inputFs, fontWeight: 600, outline: 'none' }}
          />
          <button aria-label="Apply" onClick={applyTyped} style={{ flex: 'none', padding: '0 13px', minHeight: 36, borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: s.inputFs, fontWeight: 700, cursor: 'pointer' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanConfirmView;
