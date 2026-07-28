import React from 'react';
import type { SideState } from '@/features/damage-calculator/hooks/useCalculatorState';
import { calculateStat, calculateHP } from '@/features/damage-calculator/utils/damage-calc';
import { Sprite, TypeBadge } from '@/design-system/arena';
import { natureMultiplier } from '@/features/pokemon/utils/pokemon-natures';

const natureMult = (s: SideState, stat: string) => natureMultiplier(s.nature, stat);

/** Computed stat rows laid out H/C, A/D, B/S (design order). */
export function computeStatRows(s: SideState): { l1: string; v1: number; l2: string; v2: number }[] {
  const hp = calculateHP(s.baseHp, s.spHp);
  const atk = calculateStat(s.baseAtk, s.spAtk, natureMult(s, 'atk'), s.stages.atk || 0);
  const def = calculateStat(s.baseDef, s.spDef, natureMult(s, 'def'), s.stages.def || 0);
  const spa = calculateStat(s.baseSpa, s.spSpa, natureMult(s, 'spa'), s.stages.spa || 0);
  const spd = calculateStat(s.baseSpd, s.spSpd, natureMult(s, 'spd'), s.stages.spd || 0);
  const spe = calculateStat(s.baseSpe, s.spSpe, natureMult(s, 'spe'), s.stages.spe || 0);
  return [
    { l1: 'H', v1: hp, l2: 'C', v2: spa },
    { l1: 'A', v1: atk, l2: 'D', v2: spd },
    { l1: 'B', v1: def, l2: 'S', v2: spe },
  ];
}

export function ArenaStatCard({ side, name, tone, onOpenSpecies }: {
  side: SideState; name: string; tone: 'accent' | 'danger'; onOpenSpecies: () => void;
}) {
  const types = [side.type1, side.type2].filter(Boolean) as string[];
  const rows = side.selectedId ? computeStatRows(side) : [];
  return (
    <div style={{ border: '1px solid var(--line-1)', background: 'var(--surface-card)', borderRadius: 'var(--r-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Sprite dex={side.selectedId} name={name} size={64} ring tone={tone} />
        <button onClick={onOpenSpecies} style={{ minWidth: 0, flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Select Pokémon'}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>{types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
        </button>
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: 12.5 }}>
              <span style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--ink-3)', fontWeight: 700, width: 16 }}>{r.l1}</span><span style={{ color: 'var(--ink-1)', fontWeight: 700 }}>{r.v1}</span></span>
              <span style={{ display: 'flex', gap: 6, minWidth: 64 }}><span style={{ color: 'var(--ink-3)', fontWeight: 700, width: 16 }}>{r.l2}</span><span style={{ color: 'var(--ink-1)', fontWeight: 700 }}>{r.v2}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
