// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArenaStatCard } from './ArenaStatCard';

const side = {
  selectedId: 970, type1: 'rock', type2: 'poison',
  baseHp: 83, baseAtk: 90, baseDef: 105, baseSpa: 150, baseSpd: 96, baseSpe: 101,
  nature: 'Hardy',
  spHp: 0, spAtk: 0, spDef: 0, spSpa: 32, spSpd: 0, spSpe: 0,
  boostedStat: 'spe', hinderedStat: null, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
} as any;

describe('ArenaStatCard', () => {
  it('renders six computed stat labels and a name', () => {
    render(<ArenaStatCard side={side} name="Glimmora" tone="accent" onOpenSpecies={() => {}} />);
    expect(screen.getByText('Glimmora')).toBeTruthy();
    ['H', 'A', 'B', 'C', 'D', 'S'].forEach((l) => expect(screen.getByText(l)).toBeTruthy());
  });

  it('renders no stat rows when selectedId is null', () => {
    const empty = { ...side, selectedId: null };
    render(<ArenaStatCard side={empty} name="" tone="danger" onOpenSpecies={() => {}} />);
    expect(screen.queryByText('H')).toBeNull();
  });
});
