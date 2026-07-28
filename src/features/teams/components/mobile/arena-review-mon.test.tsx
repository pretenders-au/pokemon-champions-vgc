// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArenaReviewMon } from './ArenaReviewMon';
import type { TeamWithMembers } from '@/db/repositories/team.repo';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import { getNatureStats } from '@/features/pokemon/utils/pokemon-natures';

const pokemonList = [{
  id: 6,
  identifier: 'charizard-mega-y',
  nameEn: 'Mega Charizard Y',
  nameZh: null,
  type1: 'fire',
  type2: 'flying',
  baseHp: 78,
  baseAttack: 104,
  baseDefense: 78,
  baseSpAtk: 159,
  baseSpDef: 115,
  baseSpeed: 100,
}] as PokemonBaseStats[];

const moveList = [] as MoveData[];

const config: PokemonConfig = {
  selectedId: 6,
  type1: 'fire',
  type2: 'flying',
  baseHp: 78,
  baseAtk: 104,
  baseDef: 78,
  baseSpa: 159,
  baseSpd: 115,
  baseSpe: 100,
  spHp: 32,
  spAtk: 0,
  spDef: 10,
  spSpa: 11,
  spSpd: 0,
  spSpe: 13,
  nature: 'Modest (+SPA, -ATK)',
  moves: [null, null, null, null],
  activeMoveIndex: 0,
  abilities: ['Drought'],
  activeAbility: 'Drought',
  item: 'Charizardite Y',
  hpPercent: 100,
  isTypeOverridden: false,
};

const member = {
  id: 'member-1',
  teamId: 'team-1',
  order: 0,
  configuration: config,
} as TeamWithMembers['members'][number];

describe('ArenaReviewMon SP budget', () => {
  // The team review card enforces the 66-SP team limit (openspec/specs/sp-limit-constraint).
  // The fixture spends exactly 66 — 32+0+10+11+0+13 — so there is no headroom at all.
  const renderCard = (onSave: any) =>
    render(
      <ArenaReviewMon
        portrait={false}
        member={member}
        teamName="M-B"
        pokemonList={pokemonList}
        moveList={moveList}
        onBack={() => {}}
        onSave={onSave}
        saveLabel="Save"
      />,
    );

  it('refuses to spend past the budget when it is already full', () => {
    const onSave = vi.fn();
    renderCard(onSave);
    // Atk is at 0 with zero headroom; asking for the per-stat max must change nothing.
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save(\s|$)/ }));
    expect(onSave.mock.calls.at(-1)![0]).toMatchObject({ spAtk: 0 });
  });

  it('spends only the headroom that is left', () => {
    const onSave = vi.fn();
    renderCard(onSave);
    // Free 10 by zeroing Def, then ask Atk for 32 — it may take exactly those 10.
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '0' } });
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save(\s|$)/ }));
    const saved = onSave.mock.calls.at(-1)![0];
    expect(saved).toMatchObject({ spAtk: 10, spDef: 0 });
    expect(saved.spHp + saved.spAtk + saved.spDef + saved.spSpa + saved.spSpd + saved.spSpe).toBe(66);
  });
});

describe('ArenaReviewMon nature cycling', () => {
  const setup = (onSave: any) =>
    render(
      <ArenaReviewMon
        portrait={false}
        member={member}
        teamName="M-B"
        pokemonList={pokemonList}
        moveList={moveList}
        onBack={() => {}}
        onSave={onSave}
        saveLabel="Save"
      />,
    );

  // Stat buttons render as `C`, `C ↑` or `A ↓` depending on role.
  const press = (label: string) =>
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}(\\s|$)`) }));

  it('cycles a stat neutral -> boost -> hinder, always landing on a real nature', () => {
    const onSave = vi.fn();
    setup(onSave);
    const saveAndRead = () => {
      press('Save');
      return onSave.mock.calls[onSave.mock.calls.length - 1][0];
    };

    // Starts Modest: +SpA / -Atk.
    expect(saveAndRead()).toMatchObject({ nature: 'Modest (+SPA, -ATK)' });

    // Boosting Def pairs it with the dump stat rather than leaving Def boosted alone.
    press('B');
    expect(saveAndRead()).toMatchObject({ nature: 'Bold (+DEF, -ATK)' });

    // Atk is the hindered stat here, so it cycles back to neutral — clearing both halves.
    press('A');
    expect(saveAndRead()).toMatchObject({ nature: 'Hardy' });

    // Pressing it again boosts Atk, dumping SpA.
    press('A');
    expect(saveAndRead()).toMatchObject({ nature: 'Adamant (+ATK, -SPA)' });
  });

  it('never produces a half-set nature, whichever stats are pressed', () => {
    const onSave = vi.fn();
    setup(onSave);

    // A lone boost renders x1.1 in the stat display while the damage engine reads neutral.
    // No sequence of presses may reach that state.
    for (const stat of ['A', 'B', 'C', 'D', 'S', 'A', 'C', 'B', 'S', 'D']) {
      press(stat);
      press('Save');
      const cfg = onSave.mock.calls[onSave.mock.calls.length - 1][0];
      const { boostedStat, hinderedStat } = getNatureStats(cfg.nature);
      expect(Boolean(boostedStat)).toBe(Boolean(hinderedStat));
    }
  });
});

describe('ArenaReviewMon layout', () => {
  // The body is two columns beside each other on landscape and stacked in portrait.
  // jsdom has no matchMedia, so a component that reads the viewport itself always renders
  // the landscape branch here — which is why the layout has to arrive as a prop to be testable.
  const body = () => screen.getByTestId('review-mon-body');

  const renderAt = (portrait: boolean) =>
    render(
      <ArenaReviewMon
        member={member}
        teamName="M-B"
        pokemonList={pokemonList}
        moveList={moveList}
        onBack={() => {}}
        onSave={vi.fn()}
        saveLabel="Save"
        portrait={portrait}
      />,
    );

  it('stacks the columns in portrait', () => {
    renderAt(true);
    expect(body().style.flexDirection).toBe('column');
  });

  it('puts them side by side otherwise', () => {
    renderAt(false);
    expect(body().style.flexDirection).toBe('row');
  });
});
