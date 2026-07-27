import React, { useState } from 'react';
import { calculateHP, calculateStat, getStatModifier } from '@/features/damage-calculator/utils/damage-calc';
import { convertSpToEv, convertEvToSp } from '@/features/pokemon/utils/sp-ev-converter';
import { natureMultiplier } from '@/features/pokemon/utils/pokemon-natures';

interface StatRowProps {
  statKey: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
  label: string;
  base: number;
  sp: number;
  onSpChange: (val: number) => void;
  isHp?: boolean;
  nature: string;
  onToggleNature?: (stat: string, mod: '+' | '-') => void;
  stage?: number;
  onStageChange?: (stat: string, val: number) => void;
  ability?: string | null;
  weather?: string;
  pokemonTypes?: string[];
  role?: 'attacker' | 'defender';
  hpPercent?: number;
  isEvMode?: boolean;
}

const StatRow: React.FC<StatRowProps> = ({ 
  statKey, label, base, sp, onSpChange, 
  isHp = false, nature, onToggleNature,
  stage = 0, onStageChange,
  ability = null, weather = 'None', pokemonTypes = [], role = 'attacker',
  hpPercent = 100, isEvMode = false
}) => {
  const multiplier = natureMultiplier(nature, statKey);
  const isBoosted = multiplier > 1;
  const isHindered = multiplier < 1;
  
  const abilityResult = isHp ? { modifier: 1.0, triggered: false } : getStatModifier(ability, statKey, role, pokemonTypes, weather, hpPercent);
  const total = isHp ? calculateHP(base, sp) : calculateStat(base, sp, multiplier, stage, abilityResult.modifier);

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-line last:border-0">
      {/* 1. Stat Label */}
      <div className="col-span-2 text-xs font-black text-ink-4 uppercase tracking-tighter">{label}</div>

      {/* 2. Base */}
      <div className="col-span-1 text-center text-sm font-bold text-ink-3">
        {base}
      </div>

      {/* 3. SP Slider */}
      <div className="col-span-3 px-1">
        <input
          type="range"
          min="0"
          max={isEvMode ? 252 : 32}
          step={isEvMode ? 4 : 1}
          value={isEvMode ? convertSpToEv(sp) : sp}
          onChange={(e) => onSpChange(isEvMode ? convertEvToSp(parseInt(e.target.value, 10)) : parseInt(e.target.value, 10))}
          className="w-full h-1 bg-inset rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>

      {/* 4. SP Numeric Input */}
      <div className="col-span-1 flex justify-center">
        <input
          type="number"
          min="0"
          max={isEvMode ? 252 : 32}
          step={isEvMode ? 4 : 1}
          value={sp === 0 ? '' : (isEvMode ? convertSpToEv(sp) : sp)}
          placeholder="0"
          onChange={(e) => {
            const rawVal = parseInt(e.target.value, 10);
            if (isNaN(rawVal)) {
              onSpChange(0);
              return;
            }
            const val = Math.min(isEvMode ? 252 : 32, Math.max(0, rawVal));
            onSpChange(isEvMode ? convertEvToSp(val) : val);
          }}
          className="w-10 bg-card border border-line-2 text-center text-[11px] font-black text-accent rounded-lg py-1 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all appearance-none"
        />
      </div>

      {/* 5. Nature Buttons */}
      <div className="col-span-2 flex justify-center">
        {!isHp && onToggleNature ? (
          <div className="flex gap-1">
            <button
              onClick={() => onToggleNature(statKey, '+')}
              className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black transition-all ${isBoosted ? 'bg-danger-soft text-danger border border-danger-line' : 'bg-inset text-ink-4 hover:bg-raise'}`}
            >
              +
            </button>
            <button
              onClick={() => onToggleNature(statKey, '-')}
              className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black transition-all ${isHindered ? 'bg-accent-soft text-accent border border-accent-soft-line' : 'bg-inset text-ink-4 hover:bg-raise'}`}
            >
              -
            </button>
          </div>
        ) : <div className="h-5" />}
      </div>

      {/* 6. Stage Controls */}
      <div className="col-span-2 flex justify-center">
        {!isHp && onStageChange ? (
          <div className="flex items-center bg-inset rounded-lg px-1 py-0.5 border border-line">
            <button
              onClick={() => onStageChange(statKey, stage - 1)}
              className="text-[10px] font-black text-ink-4 hover:text-accent px-1"
            >
              -
            </button>
            <span className={`text-[10px] font-black min-w-[14px] text-center ${stage > 0 ? 'text-safe' : stage < 0 ? 'text-danger' : 'text-ink-4'}`}>
              {stage !== 0 ? (stage > 0 ? `+${stage}` : stage) : ''}
            </span>
            <button
              onClick={() => onStageChange(statKey, stage + 1)}
              className="text-[10px] font-black text-ink-4 hover:text-safe px-1"
            >
              +
            </button>
          </div>
        ) : <div className="h-5" />}
      </div>

      {/* 7. Total */}
      <div className={`col-span-1 text-right text-base font-black ${isBoosted ? 'text-danger' : isHindered ? 'text-accent' : 'text-ink-1'}`}>
        {total}
      </div>
    </div>
  );
};

interface StatGridProps {
  stats: {
    hp: { base: number; sp: number };
    atk: { base: number; sp: number };
    def: { base: number; sp: number };
    spa: { base: number; sp: number };
    spd: { base: number; sp: number };
    spe: { base: number; sp: number };
  };
  nature: string;
  stages?: Record<string, number>;
  onSpChange: (key: string, val: number) => void;
  onToggleNature: (stat: string, mod: '+' | '-') => void;
  onStageChange?: (stat: string, val: number) => void;
  ability?: string | null;
  weather?: string;
  pokemonTypes?: string[];
  role?: 'attacker' | 'defender';
  hpPercent?: number;
  enforceSpLimit?: boolean;
  onResetStats?: () => void;
  className?: string;
}

const StatGrid: React.FC<StatGridProps> = ({ 
  stats, nature, stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, onSpChange, onToggleNature, onStageChange, 
  ability, weather, pokemonTypes, role, hpPercent, enforceSpLimit = false, onResetStats, className = '' 
}) => {
  const [isEvMode, setIsEvMode] = useState(false);
  const [isLimitEnforced, setIsLimitEnforced] = useState(enforceSpLimit);
  
  // Keep local state synced if prop changes
  React.useEffect(() => {
    setIsLimitEnforced(enforceSpLimit);
  }, [enforceSpLimit]);

  const totalSp = Object.values(stats).reduce((sum, s) => sum + s.sp, 0);
  const totalEv = Object.values(stats).reduce((sum, s) => sum + convertSpToEv(s.sp), 0);
  const isOverLimit = isLimitEnforced && totalSp > 66;

  const handleSpChange = (key: string, val: number, currentSp: number) => {
    if (isLimitEnforced) {
      const currentTotalWithoutThis = totalSp - currentSp;
      const maxAllowed = Math.max(0, 66 - currentTotalWithoutThis);
      const cappedVal = Math.min(val, maxAllowed);
      onSpChange(key, cappedVal);
    } else {
      onSpChange(key, val);
    }
  };

  const rowBaseProps = {
    nature, onToggleNature, onStageChange,
    ability, weather, pokemonTypes, role, hpPercent, isEvMode
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-2 text-[9px] font-black text-ink-4 uppercase tracking-widest pb-2 border-b border-line mb-2 items-center">
        <div className="col-span-2">Stat</div>
        <div className="col-span-1 text-center">Base</div>
        <div className="col-span-3 flex justify-center items-center">
          <button
            onClick={() => setIsEvMode(!isEvMode)}
            className="flex items-center gap-1 bg-inset hover:bg-raise px-2 py-0.5 rounded transition-colors border border-line-2"
          >
            <span className={isEvMode ? 'text-ink-4' : 'text-accent font-black'}>SP</span>
            <span className="text-ink-4">/</span>
            <span className={isEvMode ? 'text-accent font-black' : 'text-ink-4'}>EV</span>
          </button>
        </div>
        <div className="col-span-1 text-center"></div>
        <div className="col-span-2 text-center">Nature</div>
        <div className="col-span-2 text-center">Stage</div>
        <div className="col-span-1 text-right">Total</div>
      </div>
      
      <div className="space-y-1">
        <StatRow statKey="hp" label="HP" base={stats.hp.base} sp={stats.hp.sp} onSpChange={(val) => handleSpChange('spHp', val, stats.hp.sp)} isHp {...rowBaseProps} />
        <StatRow statKey="atk" label="Atk" base={stats.atk.base} sp={stats.atk.sp} stage={stages.atk} onSpChange={(val) => handleSpChange('spAtk', val, stats.atk.sp)} {...rowBaseProps} />
        <StatRow statKey="def" label="Def" base={stats.def.base} sp={stats.def.sp} stage={stages.def} onSpChange={(val) => handleSpChange('spDef', val, stats.def.sp)} {...rowBaseProps} />
        <StatRow statKey="spa" label="SpA" base={stats.spa.base} sp={stats.spa.sp} stage={stages.spa} onSpChange={(val) => handleSpChange('spSpa', val, stats.spa.sp)} {...rowBaseProps} />
        <StatRow statKey="spd" label="SpD" base={stats.spd.base} sp={stats.spd.sp} stage={stages.spd} onSpChange={(val) => handleSpChange('spSpd', val, stats.spd.sp)} {...rowBaseProps} />
        <StatRow statKey="spe" label="Spe" base={stats.spe.base} sp={stats.spe.sp} stage={stages.spe} onSpChange={(val) => handleSpChange('spSpe', val, stats.spe.sp)} {...rowBaseProps} />
      </div>

      {/* Summary Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-line mt-2">
        <div className="flex items-center gap-3">
          <span
            onClick={() => setIsLimitEnforced(!isLimitEnforced)}
            className={`text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors ${isLimitEnforced ? 'text-ink-4 hover:text-danger' : 'text-ink-4 hover:text-accent'}`}
            title={isLimitEnforced ? "Click to disable SP/EV limit" : "Click to enable SP/EV limit (Max 66/508)"}
          >
            {isEvMode ? `Total EV Used ${isLimitEnforced ? '(Max 508)' : ''}` : `Total SP Used ${isLimitEnforced ? '(Max 66)' : ''}`}
          </span>
          {onResetStats && (
            <button
              onClick={onResetStats}
              className="text-[10px] font-black text-danger hover:text-danger uppercase tracking-widest bg-danger-soft hover:bg-danger-soft-hover px-2 py-1 rounded transition-colors"
            >
              Reset Stats
            </button>
          )}
        </div>
        <span
          onClick={() => setIsLimitEnforced(!isLimitEnforced)}
          className={`text-base font-black cursor-pointer transition-colors ${isOverLimit ? 'text-danger hover:text-danger' : 'text-accent hover:text-accent'}`}
          title={isLimitEnforced ? "Click to disable SP/EV limit" : "Click to enable SP/EV limit (Max 66/508)"}
        >
          {isEvMode ? totalEv : totalSp} {isLimitEnforced && <span className="text-ink-4 font-bold">/ {isEvMode ? 508 : 66}</span>}
        </span>
      </div>
    </div>
  );
};

export default StatGrid;
