// The dex tables every screen loads, read through the repository so the
// "legal in this format" join lives in exactly one place.
import { useEffect, useState } from 'react';
import { pokemonRepository } from '@/db/repositories/pokemon.repo';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';

/**
 * The Pokémon legal in `format`. `[]` until the first load lands, and a fetch that
 * resolves after the format changed is dropped. Failures log and keep the last list —
 * no caller renders a loading or error state for the dex.
 */
export function usePokemonList(format: string): PokemonBaseStats[] {
  const [list, setList] = useState<PokemonBaseStats[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await pokemonRepository.getPokemonListByFormat(format);
        if (!cancelled) setList(rows);
      } catch (e) {
        console.error('[dex] pokemon list load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [format]);
  return list;
}

/** Every move. Not format-scoped — a move row is the same in any format. */
export function useMoveList(): MoveData[] {
  const [list, setList] = useState<MoveData[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await pokemonRepository.getAllMoves();
        if (!cancelled) setList(rows);
      } catch (e) {
        console.error('[dex] move list load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return list;
}
