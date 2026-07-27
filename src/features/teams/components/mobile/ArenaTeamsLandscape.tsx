import React, { useEffect, useState } from 'react';
import { Badge, Button, Icon, Sprite } from '@/design-system/arena';
import type { TeamWithMembers } from '@/db/repositories/team.repo';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { REVERSE_TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import { natureArrows } from '@/features/pokemon/utils/pokemon-natures';

export interface ArenaTeamsLandscapeProps {
  teams: TeamWithMembers[];
  pokemonList: PokemonBaseStats[];
  loading: boolean;
  error: string | null;
  onNew: () => void;          // open the full-screen "new team" import view
  onEdit: (id: string) => void; // open the 3b import page in edit mode
  onDelete: (id: string, name: string) => void;
  onExport: (team: TeamWithMembers) => void;
  onReviewMon: (teamId: string, memberId: string) => void; // open the 3c Review & save screen
  focusId?: string | null;    // team to select after a create
}

const SP_FIELDS: [keyof PokemonConfig, string][] = [
  ['spHp', 'H'], ['spAtk', 'A'], ['spDef', 'B'], ['spSpa', 'C'], ['spSpd', 'D'], ['spSpe', 'S'],
];

/** Which of a member's two source screens have been filled in. */
export function memberFlags(c: PokemonConfig): { hasStats: boolean; hasMoves: boolean } {
  const totalSp = c.spHp + c.spAtk + c.spDef + c.spSpa + c.spSpd + c.spSpe;
  return {
    hasStats: totalSp > 0,
    hasMoves: c.moves.some((m) => !!m?.nameEn),
  };
}

/** Filled-slot count and whether every slot is fully built (stats + moves). */
export function teamCompleteness(members: TeamWithMembers['members']): { filled: number; complete: boolean } {
  const filled = members.length;
  const complete = filled === 6 && members.every((m) => {
    const f = memberFlags(m.configuration);
    return f.hasStats && f.hasMoves;
  });
  return { filled, complete };
}

const micro: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const dashHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '7px 9px',
  borderRadius: 'var(--r-sm)', border: '1px dashed var(--line-2)', color: 'var(--ink-4)', fontSize: 11, fontWeight: 600,
};

function typeChip(type: string): React.CSSProperties {
  const c = `var(--type-${type})`;
  return {
    display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 8px', borderRadius: 'var(--r-xs)',
    fontFamily: 'var(--font-ui)', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
    color: c, background: `color-mix(in srgb, ${c} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
  };
}

/**
 * ArenaTeamsLandscape — the landscape master-detail Teams screen (Turn 3 of the
 * Arena design). A grouped list of your teams on the left, the selected team's
 * six slots with per-mon detail and scan-completeness on the right. Replaces the
 * rotate-to-portrait stub the Teams page used to show in landscape. "New team"
 * opens the full-screen import view (owned by the page).
 */
export const ArenaTeamsLandscape: React.FC<ArenaTeamsLandscapeProps> = ({
  teams, pokemonList, loading, error, onNew, onEdit, onDelete, onExport, onReviewMon, focusId,
}) => {
  const [selId, setSelId] = useState<string | null>(null);
  useEffect(() => { if (focusId) setSelId(focusId); }, [focusId]);

  const nameOf = (dex: number | null) => pokemonList.find((p) => p.id === dex)?.nameEn ?? 'Unknown';
  const newest = teams.length ? [...teams].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : null;
  const selected = teams.find((t) => t.id === selId) ?? newest;

  const header = (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-1)' }}>
      <Icon name="users" size={18} color="var(--accent)" />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Teams</span>
      <span style={{ flex: 1 }} />
      <button onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <Icon name="plus" size={14} color="var(--ink-2)" />New team
      </button>
    </div>
  );

  if (loading) return <div style={{ padding: '48px 24px', color: 'var(--ink-3)', textAlign: 'center' }}>Loading teams…</div>;
  if (error) return <div style={{ padding: '48px 24px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)' }}>
      {header}

      {teams.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--r-lg)', background: 'var(--surface-card)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center' }}>
            <Icon name="users-round" size={28} color="var(--accent)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--ink-1)' }}>No teams yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320, lineHeight: 1.5 }}>Add a team by importing a Showdown / Poképaste export or scanning each Pokémon.</div>
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={onNew}>New team</Button>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* left: team list */}
          <div style={{ width: 296, flex: 'none', overflowY: 'auto', scrollbarWidth: 'none', borderRight: '1px solid var(--line-1)', padding: '12px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...micro, color: 'var(--accent)' }}>My teams</div>
            {teams.map((team) => {
              const { filled, complete } = teamCompleteness(team.members);
              const active = selected?.id === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => setSelId(team.id)}
                  style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', padding: 10, borderRadius: 'var(--r-md)', cursor: 'pointer', background: active ? 'var(--accent-soft)' : 'var(--surface-card)', border: `1px solid ${active ? 'var(--accent-soft-line)' : 'var(--line-1)'}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap', color: complete ? 'var(--safe)' : 'var(--field)', background: complete ? 'var(--safe-soft)' : 'var(--field-soft)', border: `1px solid ${complete ? 'var(--safe-line)' : 'var(--field-line)'}` }}>
                      {complete ? `${filled}/6 built` : `${filled}/6`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const m = team.members[i];
                      return (
                        <div key={i} style={{ flex: 'none', width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--line-1)', overflow: 'hidden', opacity: m ? 1 : 0.35 }}>
                          {m ? <Sprite dex={m.configuration.selectedId} size={26} /> : <Icon name="plus" size={12} color="var(--ink-4)" />}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* right: selected team detail */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '14px 16px' }}>
            {selected && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Badge tone={teamCompleteness(selected.members).complete ? 'safe' : 'accent'}>{selected.members.length}/6</Badge>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: 'var(--ls-tight)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.name}</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => onEdit(selected.id)} aria-label="Edit team" style={{ width: 34, height: 34, flex: 'none', borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <Icon name="pencil" size={15} color="var(--ink-2)" />
                  </button>
                  <button onClick={() => onDelete(selected.id, selected.name)} aria-label="Delete team" style={{ width: 34, height: 34, flex: 'none', borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Icon name="trash-2" size={15} color="var(--danger)" />
                  </button>
                  <button onClick={() => onExport(selected)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    <Icon name="share" size={15} color="var(--ink-2)" />Export team
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const m = selected.members[i];
                    if (!m) {
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84, borderRadius: 'var(--r-md)', background: 'transparent', border: '1px dashed var(--line-2)', color: 'var(--ink-4)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700 }}>
                          Empty slot
                        </div>
                      );
                    }
                    const c = m.configuration;
                    const { hasStats, hasMoves } = memberFlags(c);
                    const natureStr = natureArrows(c.nature);
                    const spStr = SP_FIELDS.filter(([k]) => (c[k] as number) > 0).map(([k, l]) => `${l} ${c[k]}`).join('  ·  ');
                    return (
                      <div key={i} onClick={() => onReviewMon(selected.id, m.id)} title="Review & edit" style={{ padding: '11px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface-card)', border: '1px solid var(--line-1)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                            <Sprite dex={c.selectedId} size={36} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(c.selectedId)}</span>
                          <span style={{ flex: 1 }} />
                          {hasMoves && c.item && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 7px', borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--line-2)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                              <Icon name="scan-line" size={12} color="var(--accent)" />{c.item}
                            </span>
                          )}
                        </div>

                        {(hasStats || hasMoves) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                            {hasStats && (
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)', borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em' }}>{natureStr}</span>
                            )}
                            {hasMoves && c.activeAbility && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{c.activeAbility}</span>}
                            {hasStats && spStr && (
                              <>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>SP {spStr}</span>
                              </>
                            )}
                          </div>
                        )}

                        {hasMoves && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                            {c.moves.filter((mv): mv is NonNullable<typeof mv> => !!mv?.nameEn).map((mv, mi) => (
                              <span key={mi} style={typeChip(REVERSE_TYPE_IDS[mv.typeId] ?? 'normal')}>{mv.nameEn}</span>
                            ))}
                          </div>
                        )}

                        {!hasMoves && (
                          <div style={dashHint}><Icon name="scan-line" size={13} color="var(--ink-4)" />Scan the Moves screen for moves &amp; item</div>
                        )}
                        {!hasStats && (
                          <div style={dashHint}><Icon name="scan-line" size={13} color="var(--ink-4)" />Scan the Stats screen for stats</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
