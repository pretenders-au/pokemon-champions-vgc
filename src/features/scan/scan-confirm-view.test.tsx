// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScanConfirmView from './ScanConfirmView';
import { updateEntryId, type ScanEntry } from './roster';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';

const mon = (id: number, nameEn: string) => ({ id, nameEn, identifier: nameEn.toLowerCase() } as PokemonBaseStats);
const list = [mon(445, 'Garchomp'), mon(149, 'Dragonite'), mon(823, 'Corviknight'), mon(591, 'Amoonguss')];

/** Minimal host: owns entries state the way the real hosts do. */
function Harness({ initial }: { initial: ScanEntry[] }) {
  const [entries, setEntries] = useState<ScanEntry[]>(initial);
  return (
    <ScanConfirmView
      entries={entries}
      pokemonList={list}
      onPick={(i, id) => setEntries((e) => updateEntryId(e, i, id))}
      renderSlotActions={(i) => (
        <button onClick={() => setEntries((e) => e.filter((_, x) => x !== i))}>Remove</button>
      )}
    />
  );
}

describe('ScanConfirmView slot selection', () => {
  it('a manual pick counts as human-confirmed — review advances instead of pinning the fixed slot', () => {
    render(
      <Harness
        initial={[
          { id: 445, candidates: [{ id: 445, score: 0.5 }] },
          { id: 823, candidates: [{ id: 823, score: 0.95 }] },
        ]}
      />,
    );
    // The doubtful slot 1 is preselected; fix it by typing a name.
    expect(screen.getByText('Slot 1')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Type a name/ }), { target: { value: 'amoon' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    // The manual pick must not score as least-confident and re-pin slot 1.
    expect(screen.getByText('Slot 2')).toBeTruthy();
  });

  it('removing the selected slot snaps review to the least-confident remaining slot', () => {
    render(
      <Harness
        initial={[
          { id: 445, candidates: [{ id: 445, score: 0.95 }] },
          { id: 149, candidates: [{ id: 149, score: 0.5 }] },
          { id: 823, candidates: [{ id: 823, score: 0.99 }] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Fix Corviknight/ }));
    expect(screen.getByText('Slot 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    // Indexes shifted under the stale pick — selection must re-derive, not
    // silently target whichever entry slid into the old index.
    expect(screen.getByText('Slot 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Use Dragonite/ })).toBeTruthy();
  });
});
