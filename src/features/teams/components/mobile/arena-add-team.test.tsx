// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArenaAddTeam } from './ArenaAddTeam';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

// The scan tab pulls the capture pipeline; this suite only exercises the paste tab.
vi.mock('@/features/scan/ArenaPlayerScanReview', () => ({ ArenaPlayerScanReview: () => null }));

const pokemonList = [
  { id: 445, identifier: 'garchomp', nameEn: 'Garchomp', nameZh: null, type1: 'dragon', type2: 'ground',
    baseHp: 108, baseAttack: 130, baseDefense: 95, baseSpAtk: 80, baseSpDef: 85, baseSpeed: 102 },
] as PokemonBaseStats[];

const moveList = [{ id: 1, nameEn: 'Earthquake', nameZh: null, typeId: 5 }] as unknown as MoveData[];

const paste = (text: string) => {
  render(
    <ArenaAddTeam pokemonList={pokemonList} moveList={moveList} onBack={vi.fn()} onScanSave={vi.fn()} onCreate={vi.fn()} />
  );
  const box = screen.getByPlaceholderText(/paste a Pokémon Showdown team export/i);
  fireEvent.change(box, { target: { value: text } });
};

const SET = (species: string, ability = 'Rough Skin') =>
  `${species} @ Rocky Helmet\nAbility: ${ability}\nLevel: 50\nEVs: 252 Atk\nJolly Nature\n- Earthquake\n`;

beforeAll(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

describe('ArenaAddTeam — paste preview wiring', () => {
  it('previews a set whose species resolves', () => {
    paste(SET('Garchomp'));
    expect(screen.getByText('Garchomp')).toBeDefined();
    expect(screen.getByText(/1 Pokémon ready/i)).toBeDefined();
  });

  it('omits a set whose species does not resolve, rather than previewing an empty card', () => {
    // Set resolution treats an unknown species as fatal, so the slot is dropped entirely.
    // Before the module existed this produced a card with selectedId: null.
    paste(SET('Mewnobody'));
    expect(screen.queryByText(/1 Pokémon ready/i)).toBeNull();
    expect(screen.getByText(/0 Pokémon ready/i)).toBeDefined();
  });

  it('keeps the resolvable members of a mixed paste', () => {
    paste(SET('Garchomp') + '\n' + SET('Mewnobody'));
    expect(screen.getByText('Garchomp')).toBeDefined();
    expect(screen.getByText(/1 Pokémon ready/i)).toBeDefined();
  });

  it('carries the pasted ability through unvalidated — no ability list is available at render time', () => {
    // resolveSetWith is called with null rows here, so a typo is preserved rather than
    // reported. Matches the pre-module setToConfig behaviour.
    paste(SET('Garchomp', 'Rough Skn'));
    expect(screen.getByText('Rough Skn')).toBeDefined();
  });
});
