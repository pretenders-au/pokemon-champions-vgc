import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { Dex } from '@/features/pokemon/utils/showdown-import';
import { pokemonRepository } from '@/db/repositories/pokemon.repo';

/**
 * The dex set resolution reads from, backed by the repository.
 *
 * Kept out of `showdown-import.ts` so that module stays free of `@/db` and its tests need
 * no database — they pass their own `getAbilities`.
 */
export const appDex = (pokemonList: PokemonBaseStats[], moveList: MoveData[]): Dex => ({
  pokemonList,
  moveList,
  getAbilities: pokemonRepository.getPokemonAbilitiesBilingual,
});
