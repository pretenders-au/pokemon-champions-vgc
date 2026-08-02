// Team-preview confirm panel (window state 'panel'). The detected-grid +
// fix-detection body is the shared ScanConfirmView; this wrapper owns the
// entries state, the overlay chrome bar, and the confirm/rescan/minimize
// actions. Parent remounts (key) per scan.
import React, { useMemo, useState } from 'react';
import { seedRoster, updateEntryId, opponentIdsFromEntries, type ScanEntry } from '@/features/scan/roster';
import ScanConfirmView, { SCAN_CONFIRM_MAX_SLOTS } from '@/features/scan/ScanConfirmView';
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

const ConfirmRosterView: React.FC<ConfirmRosterViewProps> = ({ slots, pokemonList, onConfirm, onRescan, onClose }) => {
  // Drop scanner noise past the six team-preview slots before seeding, so the
  // confirmed ids can only come from what the grid displays.
  const shown = useMemo(() => slots.slice(0, SCAN_CONFIRM_MAX_SLOTS), [slots]);
  const [entries, setEntries] = useState<ScanEntry[]>(() => seedRoster(shown));
  const setPick = (slotIdx: number, id: number) => setEntries((prev) => updateEntryId(prev, slotIdx, id));
  const ids = opponentIdsFromEntries(entries);

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

      <div style={{ flex: 1, minHeight: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ScanConfirmView entries={entries} pokemonList={pokemonList} onPick={setPick} size="compact" />
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 10px', borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)' }}>
          <Icon name="shield-check" size={14} color="var(--accent)" />
          <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.35 }}>
            Saving locks these 6 species — future in-battle scans match only them.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRosterView;
