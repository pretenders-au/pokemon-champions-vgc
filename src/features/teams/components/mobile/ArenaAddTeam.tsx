import React, { useMemo, useState } from 'react';
import { Button, Icon, Sprite, TypeBadge, ItemIcon } from '@/design-system/arena';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import type { TeamWithMembers } from '@/db/repositories/team.repo';
import { parseShowdownTeam } from '@/features/pokemon/utils/showdown-parser';
import { resolveSetWith, toConfig } from '@/features/pokemon/utils/showdown-import';
import { fetchTeamFromUrl } from '@/services/paste-fetcher';
import { REVERSE_TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import { ArenaPlayerScanReview } from '@/features/scan/ArenaPlayerScanReview';
import { ArenaReviewMon } from './ArenaReviewMon';
import PokemonSearchSelect from '@/components/molecules/PokemonSearchSelect';
import { pokemonRepository } from '@/db/repositories/pokemon.repo';
import { natureArrows, NEUTRAL_NATURE } from '@/features/pokemon/utils/pokemon-natures';

export interface ArenaAddTeamProps {
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  onBack: () => void;
  onScanSave: (members: PokemonConfig[]) => void;
  onCreate: (name: string, members: PokemonConfig[]) => void | Promise<unknown>;
  /** Edit mode: pre-fill name + preview the team's current members (no paste needed). */
  initialName?: string;
  initialConfigs?: PokemonConfig[];
  submitLabel?: string;
  /** Which method tab to open on (defaults to paste). Portrait scan entry opens on 'scan'. */
  initialMethod?: 'paste' | 'scan';
  /** One preview card per row instead of three across. */
  portrait: boolean;
}

type Method = 'paste' | 'build' | 'scan';
const METHODS: { key: Method; label: string }[] = [
  { key: 'paste', label: 'Paste' },
  { key: 'build', label: 'Build' },
  { key: 'scan', label: 'Scan' },
];
const SP_FIELDS: [keyof PokemonConfig, string][] = [
  ['spHp', 'H'], ['spAtk', 'A'], ['spDef', 'B'], ['spSpa', 'C'], ['spSpd', 'D'], ['spSpe', 'S'],
];

function typeChip(type: string): React.CSSProperties {
  const c = `var(--type-${type})`;
  return {
    display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 'var(--r-xs)',
    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    color: c, background: `color-mix(in srgb, ${c} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
  };
}

const seg = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer', border: 'none',
  background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--ink-3)',
  fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
});

const textArea: React.CSSProperties = {
  width: '100%', minHeight: 150, padding: 12, borderRadius: 'var(--r-md)', resize: 'vertical',
  background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-1)',
  fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, outline: 'none',
};

/**
 * ArenaAddTeam — the full-screen "New team — import" view (Turn 3b of the Arena
 * design). Paste a Showdown export or a Poképaste link (or scan), see a live
 * preview of the six Pokémon; click a card to fine-tune it (3c); then Create.
 * Also serves edit mode (pre-filled name + paste), where Save updates the team.
 */
export const ArenaAddTeam: React.FC<ArenaAddTeamProps> = ({ pokemonList, moveList, onBack, onScanSave, onCreate, initialName, initialConfigs, submitLabel, initialMethod, portrait }) => {
  const [method, setMethod] = useState<Method>(initialMethod ?? 'paste');
  const [name, setName] = useState(initialName ?? '');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<number, PokemonConfig>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Build tab: team assembled one Pokémon at a time. Edits write back in place
  // (no `edited` overlay), so it can't cross-contaminate the paste preview.
  const [builtConfigs, setBuiltConfigs] = useState<PokemonConfig[]>([]);
  const [adderKey, setAdderKey] = useState(0); // remount the search box to clear it after each add

  const sets = useMemo(() => (method === 'scan' ? [] : parseShowdownTeam(text)), [text, method]);
  // Render-time resolution: no ability list is available synchronously, so set.ability is
  // carried through unvalidated. See CONTEXT.md ("Set resolution").
  const configs = useMemo(
    () => sets.slice(0, 6).flatMap((s) => {
      const r = resolveSetWith(s, pokemonList, moveList, null);
      return r.ok ? [toConfig(s, r.resolved)] : [];
    }),
    [sets, pokemonList, moveList]
  );
  // In edit mode, preview the team's real members until the user pastes a replacement.
  const baseConfigs = sets.length > 0 ? configs : (initialConfigs ?? []);
  const displayConfigs = method === 'build' ? builtConfigs : baseConfigs.map((cfg, i) => edited[i] ?? cfg);
  const nameOf = (dex: number | null) => pokemonList.find((p) => p.id === dex)?.nameEn ?? 'Unknown';

  // Build tab: append a picked species as a default config (0 SP, Hardy, first ability).
  const addPokemon = async (p: PokemonBaseStats) => {
    if (builtConfigs.length >= 6) return;
    let abilities: string[] = [];
    try { abilities = await pokemonRepository.getPokemonAbilities(p.id); } catch (e) { console.error('[add-team] abilities', e); }
    setBuiltConfigs((prev) => prev.length >= 6 ? prev : [...prev, {
      selectedId: p.id, type1: p.type1, type2: p.type2,
      baseHp: p.baseHp, baseAtk: p.baseAttack, baseDef: p.baseDefense,
      baseSpa: p.baseSpAtk, baseSpd: p.baseSpDef, baseSpe: p.baseSpeed,
      spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
      nature: NEUTRAL_NATURE,
      moves: [null, null, null, null], activeMoveIndex: 0,
      abilities, activeAbility: abilities[0] ?? null,
      item: null, hpPercent: 100, isTypeOverridden: false,
    }]);
    setAdderKey((k) => k + 1);
  };
  const removeBuilt = (i: number) => setBuiltConfigs((prev) => prev.filter((_, j) => j !== i));

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setError(null); setFetching(true);
    try {
      const result = await fetchTeamFromUrl(url);
      setText(result.text);
    } catch (e) {
      setError((e as Error).message || 'Failed to fetch the paste.');
    } finally {
      setFetching(false);
    }
  };

  const create = () => { if (displayConfigs.length > 0) void onCreate(name, displayConfigs); };

  // 3c editor for a clicked preview card
  if (editIndex != null && displayConfigs[editIndex]) {
    const idx = editIndex;
    const member = { id: `set-${idx}`, order: idx, configuration: displayConfigs[idx] } as unknown as TeamWithMembers['members'][number];
    return (
      <ArenaReviewMon
        portrait={portrait}
        member={member}
        teamName={name || 'New team'}
        pokemonList={pokemonList}
        moveList={moveList}
        saveLabel="Apply"
        onBack={() => setEditIndex(null)}
        onSave={(cfg) => {
          if (method === 'build') setBuiltConfigs((prev) => prev.map((c, i) => (i === idx ? cfg : c)));
          else setEdited((prev) => ({ ...prev, [idx]: cfg }));
          setEditIndex(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)' }}>
      {/* header */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--line-1)' }}>
        <button onClick={onBack} aria-label="Back to teams" style={{ width: 30, height: 30, flex: 'none', borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid var(--line-1)', color: 'var(--ink-2)', cursor: 'pointer' }}>
          <Icon name="chevron-right" size={16} color="var(--ink-2)" style={{ transform: 'scaleX(-1)' }} />
        </button>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name"
          style={{ flex: 1, minWidth: 0, height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-inset)', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-1)' }}>
          {METHODS.map((m) => (
            <button key={m.key} onClick={() => setMethod(m.key)} style={seg(method === m.key)}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '14px 16px' }}>
        {/* Keep the scan mounted (just hidden) across method switches so a scanned team isn't lost when toggling to Paste. */}
        <div style={{ display: method === 'scan' ? 'block' : 'none', height: '100%' }}>
          <ArenaPlayerScanReview portrait={portrait} pokemonList={pokemonList} moveList={moveList} onSave={onScanSave} />
        </div>
        {method !== 'scan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {method === 'paste' && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchUrl()}
                    placeholder="Paste a Poképaste / Victory Road link to fetch…"
                    style={{ flex: 1, minWidth: 0, height: 38, padding: '0 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-1)', fontFamily: 'var(--font-ui)', fontSize: 12.5, outline: 'none' }}
                  />
                  <Button variant="secondary" onClick={fetchUrl} disabled={fetching || !url.trim()}>{fetching ? 'Fetching…' : 'Fetch'}</Button>
                </div>
                {(displayConfigs.length === 0 || editing) && (
                  <textarea
                    value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="…or paste a Pokémon Showdown team export directly."
                    style={textArea}
                  />
                )}
                {error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', borderRadius: 'var(--r-sm)', padding: '7px 10px' }}>{error}</div>}
              </>
            )}
            {method === 'build' && (
              <div>
                <PokemonSearchSelect
                  key={adderKey}
                  label="Add Pokémon"
                  pokemonList={pokemonList}
                  onSelect={(p) => void addPokemon(p)}
                />
                <p style={{ fontSize: 11, color: 'var(--ink-4)', margin: '6px 2px 0' }}>
                  {builtConfigs.length >= 6
                    ? 'Team full (6). Remove a Pokémon to add another.'
                    : `Search and add Pokémon one at a time — ${6 - builtConfigs.length} slot${6 - builtConfigs.length === 1 ? '' : 's'} left. Tap a card to set its moves, item, EVs & nature.`}
                </p>
              </div>
            )}

            {displayConfigs.length > 0 && (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Preview</span>
                <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>· tap a card to edit</span>
                <span style={{ flex: 1 }} />
                {method === 'paste' && (
                  <button onClick={() => setEditing((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 9px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-3)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    <Icon name={editing ? 'chevron-up' : 'pencil'} size={12} color="var(--ink-3)" />{editing ? 'Hide editor' : 'Edit paste'}
                  </button>
                )}
              </div>
              <div data-testid="add-team-preview-grid" style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
                {displayConfigs.map((cfg, i) => {
                  const isEdited = edited[i] != null;
                  const natureStr = natureArrows(cfg.nature);
                  const spStr = SP_FIELDS.filter(([k]) => (cfg[k] as number) > 0).map(([k, l]) => `${l} ${cfg[k]}`).join(' · ');
                  return (
                    <div key={i} style={{ position: 'relative', minWidth: 0 }}>
                    <button onClick={() => setEditIndex(i)} title="Edit stats & moves" style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', padding: 10, borderRadius: 'var(--r-md)', textAlign: 'left', cursor: 'pointer', background: 'var(--surface-card)', border: `1px solid ${isEdited ? 'var(--accent-soft-line)' : 'var(--line-1)'}`, minWidth: 0 }}>
                      {/* sprite + name + types */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                          <Sprite dex={cfg.selectedId} size={32} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(cfg.selectedId)}</span>
                            {isEdited && <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)', borderRadius: 999, padding: '1px 5px', flex: 'none' }}>edited</span>}
                          </div>
                          {(cfg.type1 || cfg.type2) && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                              {cfg.type1 && <TypeBadge type={cfg.type1} size="sm" />}
                              {cfg.type2 && <TypeBadge type={cfg.type2} size="sm" />}
                            </div>
                          )}
                        </div>
                        {method !== 'build' && <Icon name="chevron-right" size={14} color="var(--ink-4)" />}
                      </div>
                      {/* item */}
                      {cfg.item && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <ItemIcon item={cfg.item} size={16} framed={false} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.item}</span>
                        </div>
                      )}
                      {/* nature + ability */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.04em' }}>{natureStr}</span>
                        {cfg.activeAbility && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.activeAbility}</span>}
                      </div>
                      {/* SP spread */}
                      {spStr && <div style={{ fontFamily: 'var(--font-display)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>SP {spStr}</div>}
                      {/* moves — 2-column grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {cfg.moves.filter((mv): mv is NonNullable<typeof mv> => !!mv?.nameEn).map((mv, mi) => (
                          <span key={mi} style={{ ...typeChip(REVERSE_TYPE_IDS[mv.typeId] ?? 'normal'), width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mv.nameEn}</span>
                        ))}
                      </div>
                    </button>
                    {method === 'build' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBuilt(i); }}
                        aria-label={`Remove ${nameOf(cfg.selectedId)}`}
                        style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--line-2)', cursor: 'pointer' }}
                      >
                        <Icon name="x" size={11} color="var(--ink-3)" />
                      </button>
                    )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* footer — Showdown/Poképaste only; the scan panel has its own Save team */}
      {method !== 'scan' && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--line-1)', background: 'var(--surface-sticky)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>
            {`${displayConfigs.length} Pokémon ready`}
          </span>
          <span style={{ flex: 1 }} />
          <Button variant="primary" icon={<Icon name="plus" size={16} />} disabled={displayConfigs.length === 0} onClick={create}>{submitLabel ?? 'Create team'}</Button>
        </div>
      )}
    </div>
  );
};
