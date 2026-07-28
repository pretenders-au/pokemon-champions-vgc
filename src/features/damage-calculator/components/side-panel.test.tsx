// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SidePanel from './SidePanel';
import { initialSide } from '@/features/damage-calculator/hooks/useCalculatorState';
import type { CalcState, CalcAction } from '@/features/damage-calculator/hooks/useCalculatorState';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

// Before this panel took (side, state, dispatch) it took 47 individual props, and nothing
// in this cluster had a test. These cover the wiring: a control moves, the right action
// goes out, for the right side.

const pokemonList = [{
  id: 445, identifier: 'garchomp', nameEn: 'Garchomp', nameZh: null, type1: 'dragon', type2: 'ground',
  baseHp: 108, baseAttack: 130, baseDefense: 95, baseSpAtk: 80, baseSpDef: 85, baseSpeed: 102,
}] as PokemonBaseStats[];

const state = {
  weather: 'None', terrain: 'None', isSpreadTarget: false,
  isFairyAura: false, isDarkAura: false, isAuraBreak: false, isGravity: false, isTrickRoom: false,
  p1: { ...initialSide, selectedId: 445, baseHp: 108, baseAtk: 130, baseDef: 95, baseSpa: 80, baseSpd: 85, baseSpe: 102 },
  p2: { ...initialSide },
} as unknown as CalcState;

const renderPanel = (side: 'p1' | 'p2' = 'p1') => {
  const dispatch = vi.fn<(a: CalcAction) => void>();
  render(
    <SidePanel
      side={side}
      state={state}
      dispatch={dispatch}
      pokemonList={pokemonList}
      moveList={[] as MoveData[]}
      onApplySpread={vi.fn()}
      onResetBuild={vi.fn()}
    />
  );
  const lastAction = () => dispatch.mock.calls[dispatch.mock.calls.length - 1][0];
  return { dispatch, lastAction };
};

beforeAll(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

describe('SidePanel wiring', () => {
  it('sends TOGGLE_NATURE when a nature button is pressed', () => {
    const { lastAction } = renderPanel();
    // Each stat row renders a nature +/- pair; the first + belongs to Atk.
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    expect(lastAction()).toEqual({ type: 'TOGGLE_NATURE', payload: { side: 'p1', stat: 'atk', mod: '+' } });
  });

  it('sends TOGGLE_SIDE_EFFECT when a support effect is checked', () => {
    const { lastAction } = renderPanel();
    fireEvent.click(screen.getByRole('checkbox', { name: /reflect/i }));
    expect(lastAction()).toEqual({ type: 'TOGGLE_SIDE_EFFECT', payload: { side: 'p1', effect: 'isReflect' } });
  });

  it('sends SET_HP_PERCENT when current HP is changed', () => {
    const { lastAction } = renderPanel();
    fireEvent.change(screen.getByRole('slider', { name: /current hp percent/i }), { target: { value: '50' } });
    expect(lastAction()).toMatchObject({ type: 'SET_HP_PERCENT', payload: { side: 'p1' } });
  });

  it('addresses the side it was rendered for', () => {
    const { lastAction } = renderPanel('p2');
    fireEvent.click(screen.getByRole('checkbox', { name: /reflect/i }));
    expect(lastAction()).toEqual({ type: 'TOGGLE_SIDE_EFFECT', payload: { side: 'p2', effect: 'isReflect' } });
  });

  it('titles each side distinctly', () => {
    renderPanel('p1');
    expect(screen.getByText('Pokémon 1')).toBeDefined();
  });
});
