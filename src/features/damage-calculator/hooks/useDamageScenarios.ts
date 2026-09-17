import { getNatureFromStats } from '@/features/pokemon/utils/pokemon-natures';
import { useMemo } from 'react';
import type { CalcState, SideState } from './useCalculatorState';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import {
  calculateSmogonDamage, flattenDamage, getMovePowerModifier,
  mapToSmogonField, mapToSmogonMove, mapToSmogonPokemon,
} from '../utils/damage-calc';
import { AEGISLASH_ID } from '@/features/pokemon/hooks/usePokemonEditor';

export interface ScenarioRange { minPercent: number; maxPercent: number; koChanceText?: string }
export interface DamageScenarios { crit: ScenarioRange | null; maxBulk: ScenarioRange | null; noSp: ScenarioRange | null }

const NULL_SCENARIOS: DamageScenarios = { crit: null, maxBulk: null, noSp: null };
const SP_ZERO = { spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0 };

/**
 * useDamageScenarios — three what-if calcs for the ACTIVE move only:
 * crit, defender at max bulk (32 HP / 32 defending stat, +nature), defender
 * uninvested. ~3 sub-ms @smogon/calc calls, memoized like useDamageCalc.
 * Only mounted by the landscape calculator, so other layouts pay nothing.
 */
export function useDamageScenarios(
  state: CalcState,
  pokemonList: PokemonBaseStats[],
  dir: 'p1' | 'p2',
): DamageScenarios {
  return useMemo(() => {
    const attacker = state[dir];
    const defender = state[dir === 'p1' ? 'p2' : 'p1'];
    const atkBase = pokemonList.find((p) => p.id === attacker.selectedId);
    const defBase = pokemonList.find((p) => p.id === defender.selectedId);
    const moveData = attacker.moves[attacker.activeMoveIndex];
    if (!atkBase || !defBase || !moveData) return NULL_SCENARIOS;

    const formName = (base: PokemonBaseStats, s: SideState) =>
      base.id === AEGISLASH_ID && s.form ? `${base.nameEn} (${s.form})` : base.nameEn;

    try {
      const field = mapToSmogonField(
        state.weather, state.isSpreadTarget, state.isFairyAura, state.isDarkAura,
        state.isAuraBreak, state.terrain, state.isGravity, attacker, defender,
      );
      const atkMon = mapToSmogonPokemon(attacker, formName(atkBase, attacker), atkBase.type1, atkBase.type2);
      const idx = attacker.activeMoveIndex;
      const customBp = getMovePowerModifier(moveData.nameEn, { faintedCount: attacker.faintedCount });
      const baseMove = mapToSmogonMove(moveData.nameEn, attacker.movesForceCrit[idx], attacker.movesHits[idx], customBp);
      const critMove = mapToSmogonMove(moveData.nameEn, true, attacker.movesHits[idx], customBp);

      const run = (defSide: SideState, move = baseMove): ScenarioRange | null => {
        const defMon = mapToSmogonPokemon(defSide, formName(defBase, defSide), defBase.type1, defBase.type2);
        const result = calculateSmogonDamage(atkMon, defMon, move, field);
        const damageArr = Array.isArray(result.damage) ? result.damage : [Number(result.damage) || 0];
        const clean = flattenDamage(damageArr as any[]);
        const min = clean.length ? clean[0] : 0;
        const max = clean.length ? clean[clean.length - 1] : 0;
        const maxHP = defMon.maxHP();
        let koChanceText: string | undefined;
        try { const ko = (result as any).kochance?.(); if (ko && ko.text) koChanceText = ko.text; } catch { /* ignore */ }
        return {
          minPercent: Math.floor((min * 1000) / maxHP) / 10 || 0,
          maxPercent: Math.floor((max * 1000) / maxHP) / 10 || 0,
          koChanceText,
        };
      };

      // Psyshock/Psystrike/Secret Sword are Special but damage against Def —
      // prefer the move's overrideDefensiveStat over its category.
      const defStat = critMove.overrideDefensiveStat
        ?? (critMove.category === 'Physical' ? 'def' : 'spd');
      const investsDef = defStat === 'def';
      const maxBulkSide = {
        ...defender,
        spHp: 32,
        ...(investsDef ? { spDef: 32 } : { spSpd: 32 }),
        nature: getNatureFromStats(investsDef ? 'def' : 'spd', 'atk'),
      } as SideState;
      const noSpSide = { ...defender, ...SP_ZERO, nature: 'Hardy' } as SideState;

      return {
        crit: run(defender, critMove),
        maxBulk: run(maxBulkSide),
        noSp: run(noSpSide),
      };
    } catch {
      return NULL_SCENARIOS;
    }
  }, [state, pokemonList, dir]);
}
