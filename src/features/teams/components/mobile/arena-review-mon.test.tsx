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
  // Before `portrait` became a prop this was read from a global, and since jsdom has no
  // matchMedia every test in this file rendered the landscape branch — the portrait one
  // had never executed.
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
