import { calculateSmogonDamage, mapToSmogonPokemon, mapToSmogonMove, mapToSmogonField } from '@/features/damage-calculator/utils/damage-calc';
import { describe, it, expect } from 'vitest';

describe('Critical Hit Mechanics', () => {
  const baseState = {
    isTypeOverridden: false,
    type1: 'normal',
    type2: null,
    baseHp: 100, baseAtk: 100, baseDef: 100, baseSpa: 100, baseSpd: 100, baseSpe: 100,
    nature: 'Hardy',
    spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
    stages: {},
    boostedStat: null,
    hinderedStat: null,
    hpPercent: 100,
    activeAbility: null,
    item: null,
    isReflect: false,
    isLightScreen: false,
    isAuroraVeil: false,
    isHelpingHand: false,
    isFriendGuard: false,
    isTailwind: false,
    movesForceCrit: [false, false, false, false],
  };

  it('should increase damage when move is forced to crit', () => {
    const attacker = mapToSmogonPokemon(baseState, 'Garchomp', 'dragon', 'ground');
    const defender = mapToSmogonPokemon(baseState, 'Tyranitar', 'rock', 'dark');
    
    const moveNoCrit = mapToSmogonMove('Earthquake', false);
    const moveWithCrit = mapToSmogonMove('Earthquake', true);
    
    const field = mapToSmogonField('None', false, false, false, false, 'None', false, {}, {});

    const resultNoCrit = calculateSmogonDamage(attacker, defender, moveNoCrit, field);
    const resultWithCrit = calculateSmogonDamage(attacker, defender, moveWithCrit, field);

    const damageNoCrit = (resultNoCrit.damage as number[])[0];
    const damageWithCrit = (resultWithCrit.damage as number[])[0];

    expect(damageWithCrit).toBeGreaterThan(damageNoCrit);
    expect(resultWithCrit.desc()).toContain('critical hit');
  });
});
