// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const getPokemonListByFormat = vi.fn();
const getAllMoves = vi.fn();
vi.mock('@/db/repositories/pokemon.repo', () => ({
  pokemonRepository: {
    getPokemonListByFormat: (f: string) => getPokemonListByFormat(f),
    getAllMoves: () => getAllMoves(),
  },
}));

import { usePokemonList, useMoveList } from './useDex';

const mon = (id: number, nameEn: string) => ({ id, nameEn }) as any;

beforeEach(() => {
  getPokemonListByFormat.mockReset();
  getAllMoves.mockReset().mockResolvedValue([]);
});

describe('usePokemonList', () => {
  it('reads the format through the repository, not a hand-written join', async () => {
    getPokemonListByFormat.mockResolvedValue([mon(1, 'Incineroar')]);
    const { result } = renderHook(() => usePokemonList('Regulation M-B'));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(getPokemonListByFormat).toHaveBeenCalledWith('Regulation M-B');
  });

  it('refetches when the format changes', async () => {
    getPokemonListByFormat.mockResolvedValue([mon(1, 'Incineroar')]);
    const { rerender } = renderHook(({ f }) => usePokemonList(f), { initialProps: { f: 'A' } });
    await waitFor(() => expect(getPokemonListByFormat).toHaveBeenCalledWith('A'));
    rerender({ f: 'B' });
    await waitFor(() => expect(getPokemonListByFormat).toHaveBeenCalledWith('B'));
  });

  it('drops a fetch that resolves after the format moved on', async () => {
    // The old format's rows land last. Without the cancelled guard they would
    // overwrite the new format's list, leaving the screen showing illegal Pokémon.
    let settleOld: (v: unknown) => void = () => {};
    getPokemonListByFormat
      .mockImplementationOnce(() => new Promise((res) => { settleOld = res; }))
      .mockResolvedValueOnce([mon(2, 'Rillaboom')]);

    const { result, rerender } = renderHook(({ f }) => usePokemonList(f), { initialProps: { f: 'A' } });
    rerender({ f: 'B' });
    await waitFor(() => expect(result.current).toEqual([mon(2, 'Rillaboom')]));

    // Inside act(), so a stale setList would actually be flushed into result.current.
    // Without it this assertion passes even with the cancelled guard deleted.
    await act(async () => {
      settleOld([mon(1, 'Incineroar')]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toEqual([mon(2, 'Rillaboom')]);
  });

  it('keeps the last good list when a load fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    getPokemonListByFormat.mockRejectedValue(new Error('db gone'));
    const { result } = renderHook(() => usePokemonList('A'));
    await waitFor(() => expect(err).toHaveBeenCalled());
    expect(result.current).toEqual([]);
    err.mockRestore();
  });
});

describe('useMoveList', () => {
  it('loads every move once, not per format', async () => {
    getAllMoves.mockResolvedValue([{ id: 1, nameEn: 'Fake Out' }]);
    const { result, rerender } = renderHook(() => useMoveList());
    await waitFor(() => expect(result.current).toHaveLength(1));
    rerender();
    expect(getAllMoves).toHaveBeenCalledTimes(1);
  });
});
