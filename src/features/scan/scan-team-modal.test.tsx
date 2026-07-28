// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SlotResult } from './types';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';

// The modal builds its own legalIds and calls useTeamScan without injectable deps, so the
// scan result is supplied by mocking the hook rather than by threading a new prop.
let slots: SlotResult[] = [];
let mode: 'team' | 'battle' = 'team';
vi.mock('./useTeamScan', () => ({
  useTeamScan: () => ({ status: 'done', slots, mode, error: null, scan: vi.fn(), reset: vi.fn() }),
  DEFAULT_DEPS: {},
}));

import ScanTeamModal from './ScanTeamModal';

const pokemonList = [
  { id: 1, nameEn: 'Incineroar' }, { id: 2, nameEn: 'Rillaboom' }, { id: 3, nameEn: 'Amoonguss' },
].map((p) => ({ ...p, identifier: p.nameEn.toLowerCase(), nameZh: null, type1: 'normal', type2: null,
  baseHp: 100, baseAttack: 100, baseDefense: 100, baseSpAtk: 100, baseSpDef: 100, baseSpeed: 100 })) as PokemonBaseStats[];

const slot = (side: 'player' | 'opponent', ...pairs: Array<[number, number]>): SlotResult =>
  ({ box: { x: 0, y: 0, w: 1, h: 1 }, side, hpPercent: null, candidates: pairs.map(([id, score]) => ({ id, score })) }) as SlotResult;

const open = (onConfirmRoster = vi.fn()) => {
  render(
    <ScanTeamModal isOpen onClose={vi.fn()} pokemonList={pokemonList} onConfirmRoster={onConfirmRoster} />
  );
  return onConfirmRoster;
};

beforeEach(() => { slots = []; mode = 'team'; });

describe('ScanTeamModal roster seeding', () => {
  it('re-picks a duplicate species on the same side — a team cannot field two', () => {
    // Both opponent slots read Incineroar as top candidate; only one can be right.
    slots = [slot('opponent', [1, 0.9], [2, 0.5]), slot('opponent', [1, 0.8], [3, 0.4])];
    open();
    expect(screen.getAllByText('Incineroar')).toHaveLength(1);
    expect(screen.getAllByText('Amoonguss').length).toBeGreaterThan(0);
  });

  it('keeps the same species on opposite sides — a mirror match is legal', () => {
    // Both rows only render in battle mode; a team-preview scan hides your own side.
    mode = 'battle';
    slots = [slot('opponent', [1, 0.9]), slot('player', [1, 0.9])];
    open();
    expect(screen.getAllByText('Incineroar')).toHaveLength(2);
  });

  it('confirms unique opponent ids, excluding the player side', () => {
    slots = [slot('opponent', [1, 0.9]), slot('opponent', [2, 0.9]), slot('player', [3, 0.9])];
    const onConfirmRoster = open();
    fireEvent.click(screen.getByRole('button', { name: /lock|confirm/i }));
    expect(onConfirmRoster).toHaveBeenCalledWith([1, 2]);
  });
});
