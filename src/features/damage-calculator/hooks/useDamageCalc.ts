import { useMemo } from 'react';
import { SideState, CalcState } from '@/features/damage-calculator/hooks/useCalculatorState';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { TypeEfficacyMap, calculateEffectiveness } from '@/features/pokemon/utils/type-effectiveness';
import { TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import { calculateHP, calculateSmogonDamage, mapToSmogonPokemon, mapToSmogonField, mapToSmogonMove, getMovePowerModifier, flattenDamage } from '@/features/damage-calculator/utils/damage-calc';
import { AEGISLASH_ID } from '@/features/pokemon/hooks/usePokemonEditor';
import { DamageResult } from '@/components/organisms/ResultsPanel';

export function useDamageCalc(
  state: CalcState,
  pokemonList: PokemonBaseStats[],
  efficacyMap: TypeEfficacyMap
) {
  const p1MaxHp = useMemo(() => calculateHP(state.p1.baseHp, state.p1.spHp), [state.p1.baseHp, state.p1.spHp]);
  const p2MaxHp = useMemo(() => calculateHP(state.p2.baseHp, state.p2.spHp), [state.p2.baseHp, state.p2.spHp]);

  const computeResults = (attacker: SideState, defender: SideState, defMaxHp: number): (DamageResult | null)[] => {
    const atkBase = pokemonList.find(p => p.id === attacker.selectedId);
    const defBase = pokemonList.find(p => p.id === defender.selectedId);

    if (!atkBase || !defBase) return [null, null, null, null];

    const getFormName = (base: PokemonBaseStats, side: SideState) => {
      if (base.id === AEGISLASH_ID && side.form) {
        return `${base.nameEn} (${side.form})`;
      }
      return base.nameEn;
    };

    const attackerPokemon = mapToSmogonPokemon(attacker, getFormName(atkBase, attacker), atkBase.type1, atkBase.type2);
    const defenderPokemon = mapToSmogonPokemon(defender, getFormName(defBase, defender), defBase.type1, defBase.type2);
    
    const field = mapToSmogonField(
      state.weather, 
      state.isSpreadTarget,
      state.isFairyAura,
      state.isDarkAura,
      state.isAuraBreak,
      state.terrain, 
      state.isGravity, 
      attacker, // attacker side
      defender  // defender side
    );

    return attacker.moves.map((moveData, moveIdx) => {
      if (!moveData) return null;

      const isCrit = attacker.movesForceCrit[moveIdx];
      const hits = attacker.movesHits[moveIdx];
      const customBp = getMovePowerModifier(moveData.nameEn, { faintedCount: attacker.faintedCount });
      const move = mapToSmogonMove(moveData.nameEn, isCrit, hits, customBp);

      const result = calculateSmogonDamage(attackerPokemon, defenderPokemon, move, field);
      const damageArr = Array.isArray(result.damage) ? result.damage : [result.damage || 0];

      const cleanDamage = flattenDamage(damageArr);
      const minDamage = cleanDamage.length > 0 ? cleanDamage[0] : 0;
      const maxDamage = cleanDamage.length > 0 ? cleanDamage[cleanDamage.length - 1] : 0;

      let effectiveness = 1;
      const activeDefType1 = defender.isTypeOverridden ? defender.type1 : defBase.type1;
      const activeDefType2 = defender.isTypeOverridden ? defender.type2 : defBase.type2;
      const defType1Id = activeDefType1 ? TYPE_IDS[activeDefType1.toLowerCase()] : null;
      const defType2Id = activeDefType2 ? TYPE_IDS[activeDefType2.toLowerCase()] : null;
      
      const calcMoveTypeId = TYPE_IDS[result.move.type.toLowerCase()] || moveData.typeId;
      effectiveness = calculateEffectiveness(efficacyMap, calcMoveTypeId, defType1Id, defType2Id);

      const activeAtkType1 = attacker.isTypeOverridden ? attacker.type1 : atkBase.type1;
      const activeAtkType2 = attacker.isTypeOverridden ? attacker.type2 : atkBase.type2;
      const attackerType1Id = activeAtkType1 ? TYPE_IDS[activeAtkType1.toLowerCase()] : null;
      const attackerType2Id = activeAtkType2 ? TYPE_IDS[activeAtkType2.toLowerCase()] : null;
      const isStab = calcMoveTypeId === attackerType1Id || calcMoveTypeId === attackerType2Id;

      const isImmune = result.damage === 0 || maxDamage === 0;
      const triggeredAbilities: string[] = [];
      let koChanceText = 'Survival';

      if (!isImmune) {
        try {
          const descStr = result.desc();
          if (result.attacker.ability && descStr.includes(result.attacker.ability)) triggeredAbilities.push(result.attacker.ability);
          if (result.defender.ability && descStr.includes(result.defender.ability)) triggeredAbilities.push(result.defender.ability);
          const koObj = result.kochance();
          if (koObj && koObj.text) koChanceText = koObj.text;
        } catch (e) {}
      }

      const smogonDefMaxHp = defenderPokemon.maxHP();
      return {
        minDamage, maxDamage,
        minPercent: Math.floor((minDamage * 1000) / smogonDefMaxHp) / 10 || 0,
        maxPercent: Math.floor((maxDamage * 1000) / smogonDefMaxHp) / 10 || 0,
        moveName: moveData.nameEn,
        moveNameZh: moveData.nameZh,
        moveType: calcMoveTypeId,
        originalType: moveData.typeId,
        isStab, effectiveness, triggeredAbilities, koChanceText
      } as DamageResult;
    });
  };

  const p1Results = useMemo(() => computeResults(state.p1, state.p2, p2MaxHp), [state.p1, state.p2, p2MaxHp, efficacyMap, state.weather, state.terrain, state.isGravity, state.isSpreadTarget, state.isFairyAura, state.isDarkAura, state.isAuraBreak]);
  const p2Results = useMemo(() => computeResults(state.p2, state.p1, p1MaxHp), [state.p2, state.p1, p1MaxHp, efficacyMap, state.weather, state.terrain, state.isGravity, state.isSpreadTarget, state.isFairyAura, state.isDarkAura, state.isAuraBreak]);

  return { p1MaxHp, p2MaxHp, p1Results, p2Results };
}
