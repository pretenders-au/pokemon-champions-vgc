import React from 'react';
import { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import { calculateHP, calculateStat } from '@/features/damage-calculator/utils/damage-calc';
import { natureMultiplier, natureWheelIndex } from '@/features/pokemon/utils/pokemon-natures';
import { isOverSpBudget, SP_TOTAL } from '@/features/pokemon/utils/sp-ev-converter';
import PokemonImage from '@/components/atoms/PokemonImage';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';

interface TeamMemberStatDisplayProps {
  config: PokemonConfig;
  pokemonList: PokemonBaseStats[];
}

const StatRow = ({ label, base, sp, total, isBoosted, isHindered }: { label: string, base: number, sp: number, total: number, isBoosted?: boolean, isHindered?: boolean }) => (
  <div className="grid grid-cols-4 gap-2 items-center py-1 border-b border-line last:border-0 text-[10px]">
    <div className="col-span-1 font-black text-ink-4 uppercase tracking-tighter">{label}</div>
    <div className="col-span-1 text-center font-bold text-ink-3">{base}</div>
    <div className="col-span-1 text-center font-bold text-accent">{sp}</div>
    <div className={`col-span-1 text-right font-black ${isBoosted ? 'text-danger' : isHindered ? 'text-accent' : 'text-ink-1'}`}>{total}</div>
  </div>
);

const TeamMemberStatDisplay: React.FC<TeamMemberStatDisplayProps> = ({ config, pokemonList }) => {
  const hpTotal = calculateHP(config.baseHp, config.spHp);
  const atkTotal = calculateStat(config.baseAtk, config.spAtk, natureMultiplier(config.nature, 'atk'), 0, 1.0);
  const defTotal = calculateStat(config.baseDef, config.spDef, natureMultiplier(config.nature, 'def'), 0, 1.0);
  const spaTotal = calculateStat(config.baseSpa, config.spSpa, natureMultiplier(config.nature, 'spa'), 0, 1.0);
  const spdTotal = calculateStat(config.baseSpd, config.spSpd, natureMultiplier(config.nature, 'spd'), 0, 1.0);
  const speTotal = calculateStat(config.baseSpe, config.spSpe, natureMultiplier(config.nature, 'spe'), 0, 1.0);

  const totalSp = config.spHp + config.spAtk + config.spDef + config.spSpa + config.spSpd + config.spSpe;
  const isOverLimit = isOverSpBudget(totalSp);

  return (
    <div className="bg-card rounded-xl border border-line p-2">
      <div className="grid grid-cols-4 gap-2 text-[8px] font-black text-ink-4 uppercase tracking-widest pb-1 border-b border-line mb-1">
        <div className="col-span-1 text-left">Stat</div>
        <div className="col-span-1 text-center">Base</div>
        <div className="col-span-1 text-center">SP</div>
        <div className="col-span-1 text-right">Total</div>
      </div>
      <div className="space-y-0.5">
        <StatRow label="HP" base={config.baseHp} sp={config.spHp} total={hpTotal} />
        <StatRow label="Atk" base={config.baseAtk} sp={config.spAtk} total={atkTotal} isBoosted={natureWheelIndex(config.nature, 'atk') === 2} isHindered={natureWheelIndex(config.nature, 'atk') === 0} />
        <StatRow label="Def" base={config.baseDef} sp={config.spDef} total={defTotal} isBoosted={natureWheelIndex(config.nature, 'def') === 2} isHindered={natureWheelIndex(config.nature, 'def') === 0} />
        <StatRow label="SpA" base={config.baseSpa} sp={config.spSpa} total={spaTotal} isBoosted={natureWheelIndex(config.nature, 'spa') === 2} isHindered={natureWheelIndex(config.nature, 'spa') === 0} />
        <StatRow label="SpD" base={config.baseSpd} sp={config.spSpd} total={spdTotal} isBoosted={natureWheelIndex(config.nature, 'spd') === 2} isHindered={natureWheelIndex(config.nature, 'spd') === 0} />
        <StatRow label="Spe" base={config.baseSpe} sp={config.spSpe} total={speTotal} isBoosted={natureWheelIndex(config.nature, 'spe') === 2} isHindered={natureWheelIndex(config.nature, 'spe') === 0} />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-line mt-1">
        <span className="text-[8px] font-black text-ink-4 uppercase tracking-tighter">Total SP</span>
        <span className={`text-[10px] font-black ${isOverLimit ? 'text-danger' : 'text-accent'}`}>
          {totalSp} / {SP_TOTAL}
        </span>
      </div>
    </div>
  );
};

export default TeamMemberStatDisplay;
