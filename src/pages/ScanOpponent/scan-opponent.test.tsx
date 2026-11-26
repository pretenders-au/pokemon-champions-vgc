// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SlotResult } from '@/features/scan/types';

const crop = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
const slot = (side: 'player' | 'opponent', id: number): SlotResult =>
  ({ box: { x: 0, y: 0, w: 1, h: 1 }, side, hpPercent: null, candidates: [{ id, score: 0.9 }], crop });
const slots = [slot('opponent', 1), slot('player', 2)];

vi.mock('@/features/scan/useTeamScan', () => ({
  useTeamScan: () => ({ status: 'done', slots, mode: 'team', error: null, scan: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/features/scan/corrections', () => ({ recordCorrections: vi.fn(async () => {}) }));
vi.mock('@/features/pokemon/hooks/useDex', () => ({
  usePokemonList: () => [{ id: 1, nameEn: 'Incineroar', identifier: 'incineroar' }, { id: 2, nameEn: 'Rillaboom', identifier: 'rillaboom' }],
}));
vi.mock('@/features/formats/FormatContext', () => ({ useFormat: () => ({ format: 'test' }) }));

import ScanOpponentPage from './index';
import { recordCorrections } from '@/features/scan/corrections';

describe('ScanOpponentPage correction capture', () => {
  it('confirming hands the opponent entries the page showed to correction capture', () => {
    render(<MemoryRouter><ScanOpponentPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /confirm & save/i }));
    const passed = vi.mocked(recordCorrections).mock.calls.map(([entries]) => entries.map((e) => [e.side, e.id, e.scanned?.crop]));
    expect(passed).toEqual([[['opponent', 1, crop]]]);
  });
});
