import React, { useState, useMemo } from 'react';
import EvSpForm, { EvSpread } from '@/components/organisms/EvSpForm';
import { convertEvToSp, SP_TOTAL } from '@/features/pokemon/utils/sp-ev-converter';
import Typography from '@/components/atoms/Typography';
import { useViewportMode } from '@/hooks/useViewportMode';
import { RotateToPortrait } from '@/components/RotateToPortrait';
import { ArenaEvSp } from './ArenaEvSp';

const EvSpConverterPage: React.FC = () => {
  const mode = useViewportMode();
  const isMobile = mode === 'arena';
  const [spread, setSpread] = useState<EvSpread>({
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  });

  const handleSpreadChange = (newSpread: EvSpread) => {
    // Find which stat changed
    const changedStat = (Object.keys(newSpread) as (keyof EvSpread)[]).find(
      (key) => newSpread[key] !== spread[key]
    );

    if (!changedStat) return;

    // Calculate current sum of all other stats
    const otherStatsSum = (Object.keys(spread) as (keyof EvSpread)[])
      .filter((key) => key !== changedStat)
      .reduce((sum, key) => sum + spread[key], 0);

    // Calculate remaining pool
    const maxAllowed = 510 - otherStatsSum;

    // Cap the new value
    const cappedValue = Math.min(newSpread[changedStat], maxAllowed);

    setSpread({
      ...newSpread,
      [changedStat]: cappedValue,
    });
  };

  const handleReset = () => {
    setSpread({
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    });
  };

  const totals = useMemo(() => {
    const values = Object.values(spread);
    const totalEvs = values.reduce((sum, val) => sum + val, 0);
    const totalSp = values.reduce((sum, val) => sum + convertEvToSp(val), 0);
    
    return { totalEvs, totalSp };
  }, [spread]);

  if (mode === 'arena-landscape') return <RotateToPortrait label="EV / SP" />;

  if (isMobile) {
    return (
      <ArenaEvSp
        spread={spread}
        onSpreadChange={handleSpreadChange}
        onReset={handleReset}
        totalEvs={totals.totalEvs}
        totalSp={totals.totalSp}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-12">
        <Typography variant="h1" className="mb-4">
          EV to SP Converter
        </Typography>
        <Typography variant="body" className="max-w-xl mx-auto block">
          Pokémon Champions uses a custom "SP" (Special Points) system instead of EVs. 
          Use this tool to translate your traditional VGC spreads. 
          The formula is <code className="bg-inset text-accent px-1 rounded font-mono font-bold">SP = floor((EV + 4) / 8)</code>.
        </Typography>
      </div>

      <EvSpForm 
        spread={spread} 
        onSpreadChange={handleSpreadChange} 
        onReset={handleReset}
        totalEvs={totals.totalEvs} 
        totalSp={totals.totalSp} 
      />

      <div className="mt-12 p-6 bg-card rounded-xl border border-line">
        <Typography variant="h2" className="text-ink-1 mb-2">
          System Rules
        </Typography>
        <ul className="list-disc list-inside space-y-2 text-ink-2 text-sm">
          <li>Max EVs per stat: <strong>252</strong> (yields 32 SP)</li>
          <li>Total EVs allowed: <strong>510</strong></li>
          <li>Total SP generated: <strong>{SP_TOTAL}</strong> (based on 510 total EVs)</li>
          <li>Minimum EVs for 1 SP: <strong>4</strong></li>
          <li>Subsequent SP points every <strong>8</strong> EVs</li>
        </ul>
      </div>
    </div>
  );
};

export default EvSpConverterPage;
