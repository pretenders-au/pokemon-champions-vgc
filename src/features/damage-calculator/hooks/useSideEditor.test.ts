// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSideEditor } from './useSideEditor';
import type { CalcAction } from './useCalculatorState';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

// The dex-dependent edits (species, preset, showdown import, load config) go through
// useCalculatorActions, which reads abilities from the db before dispatching. This suite
// covers the direct ones — every edit that maps straight to a CalcAction.
const move = { id: 7, nameEn: 'Earthquake' } as unknown as MoveData;

const editorFor = (side: 'p1' | 'p2') => {
  const dispatch = vi.fn<(a: CalcAction) => void>();
  const { result } = renderHook(() =>
    useSideEditor(side, dispatch, [] as PokemonBaseStats[], [] as MoveData[])
  );
  return { editor: result.current, dispatch, sent: () => dispatch.mock.calls[0][0] };
};

describe('useSideEditor', () => {
  it('maps each edit to its action', () => {
    const cases: [keyof ReturnType<typeof editorFor>['editor'], unknown[], CalcAction['type'], object][] = [
      ['setSp', ['spAtk', 20], 'SET_SP', { key: 'spAtk', val: 20 }],
      ['setNature', ['Timid (+SPE, -ATK)'], 'SET_NATURE', { nature: 'Timid (+SPE, -ATK)' }],
      ['toggleNature', ['atk', '+'], 'TOGGLE_NATURE', { stat: 'atk', mod: '+' }],
      ['setStage', ['spe', 2], 'SET_STAT_STAGE', { stat: 'spe', val: 2 }],
      ['setMove', [1, move], 'SELECT_MOVE_FOR_SLOT', { index: 1, move }],
      ['clearMove', [3], 'CLEAR_MOVE_SLOT', { index: 3 }],
      ['setAbility', ['Intimidate'], 'SET_ACTIVE_ABILITY', { ability: 'Intimidate' }],
      ['setItem', ['Life Orb'], 'SET_ITEM', { item: 'Life Orb' }],
      ['setType', [1, 'fire'], 'SET_TYPE', { slot: 1, type: 'fire' }],
      ['toggleTypeOverride', [], 'TOGGLE_TYPE_OVERRIDE', {}],
      ['toggleAegislashForm', [], 'TOGGLE_AEGISLASH_FORM', {}],
      ['resetStats', [], 'RESET_STATS', {}],
    ];

    for (const [name, args, type, payload] of cases) {
      const { editor, dispatch, sent } = editorFor('p1');
      (editor[name] as (...a: unknown[]) => void)(...args);
      expect(dispatch, `${name} dispatched once`).toHaveBeenCalledTimes(1);
      expect(sent(), `${name} action`).toEqual({ type, payload: { side: 'p1', ...payload } });
    }
  });

  it('always carries the side it was built for, so a panel cannot edit the other Pokémon', () => {
    for (const side of ['p1', 'p2'] as const) {
      const { editor, sent } = editorFor(side);
      editor.setSp('spAtk', 32);
      expect((sent() as { payload: { side: string } }).payload.side).toBe(side);
    }
  });

  it('offers every edit the build form asks for', () => {
    // A missing member silently hides its control in PokemonConfigForm rather than failing.
    const { editor } = editorFor('p1');
    for (const name of [
      'selectPokemon', 'selectPreset', 'importShowdown', 'loadConfig', 'setSp', 'setNature',
      'toggleNature', 'setStage', 'setMove', 'clearMove', 'setAbility', 'setItem', 'setType',
      'toggleTypeOverride', 'toggleAegislashForm', 'resetStats',
    ] as const) {
      expect(typeof editor[name], name).toBe('function');
    }
  });
});
