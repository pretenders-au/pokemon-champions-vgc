// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmRosterView from './ConfirmRosterView';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { SlotResult } from '../scan/types';

const mon = (id: number, nameEn: string) => ({ id, nameEn, identifier: nameEn.toLowerCase() } as PokemonBaseStats);
const list = [mon(445, 'Garchomp'), mon(149, 'Dragonite'), mon(823, 'Corviknight'), mon(591, 'Amoonguss')];
const slot = (candidates: Array<{ id: number; score: number }>, x = 0): SlotResult =>
  ({ box: { x, y: 0, w: 10, h: 10 }, candidates });

describe('ConfirmRosterView', () => {
  it('shows top candidate per slot with confidence and confirms the ids', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 445, score: 0.92 }]), slot([{ id: 823, score: 0.99 }])]}
        pokemonList={list}
        onConfirm={onConfirm}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    // The name and % can appear on both the card and the fix-panel row.
    expect(screen.getAllByText('Garchomp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('92%').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Confirm & save/ }));
    expect(onConfirm).toHaveBeenCalledWith([445, 823]);
  });

  it('pre-selects the least-confident slot in the fix panel', () => {
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 823, score: 0.99 }]), slot([{ id: 445, score: 0.61 }, { id: 149, score: 0.26 }])]}
        pokemonList={list}
        onConfirm={() => {}}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Slot 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Use Dragonite/ })).toBeTruthy();
  });

  it('lets the user swap a slot to another candidate', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 445, score: 0.61 }, { id: 149, score: 0.26 }])]}
        pokemonList={list}
        onConfirm={onConfirm}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Fix Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Use Dragonite/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm & save/ }));
    expect(onConfirm).toHaveBeenCalledWith([149]);
  });

  it('typing replaces top candidates with live dex matches; tapping one picks it', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 445, score: 0.61 }, { id: 149, score: 0.26 }])]}
        pokemonList={list}
        onConfirm={onConfirm}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Type a name/ }), { target: { value: 'corv' } });
    expect(screen.queryByRole('button', { name: /Use Dragonite/ })).toBeNull(); // candidates hidden
    fireEvent.click(screen.getByRole('button', { name: /Use Corviknight/ }));
    // picking clears the query, so candidates return
    expect(screen.getByRole('button', { name: /Use Dragonite/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirm & save/ }));
    expect(onConfirm).toHaveBeenCalledWith([823]);
  });

  it('applies a typed name to the selected slot', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 445, score: 0.61 }])]}
        pokemonList={list}
        onConfirm={onConfirm}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Type a name/ }), { target: { value: 'amoon' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm & save/ }));
    expect(onConfirm).toHaveBeenCalledWith([591]);
  });

  it('scores the selected candidate, so a re-picked weak slot still shows its confidence', () => {
    // Both slots top Garchomp; Species Clause means one is wrong, so slot 2 falls to its
    // second candidate. The tile must report that candidate's score, not the rejected one's.
    render(
      <ConfirmRosterView
        slots={[slot([{ id: 445, score: 0.92 }]), slot([{ id: 445, score: 0.88 }, { id: 149, score: 0.40 }])]}
        pokemonList={list}
        onConfirm={vi.fn()}
        onRescan={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getAllByText('Dragonite').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
    expect(screen.queryByText('88%')).toBeNull();
  });

  it('caps the detected grid at 6 slots', () => {
    const seven = [445, 149, 823, 591, 445, 149, 823].map((id, i) => slot([{ id, score: 0.9 }], i));
    render(
      <ConfirmRosterView slots={seven} pokemonList={list} onConfirm={() => {}} onRescan={() => {}} onClose={() => {}} />,
    );
    expect(screen.getAllByRole('button', { name: /^Fix / })).toHaveLength(6);
  });

  it('wires rescan and close', () => {
    const onRescan = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmRosterView slots={[slot([{ id: 445, score: 0.9 }])]} pokemonList={list} onConfirm={() => {}} onRescan={onRescan} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Re-scan/ }));
    fireEvent.click(screen.getByRole('button', { name: /Minimize/ }));
    expect(onRescan).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
