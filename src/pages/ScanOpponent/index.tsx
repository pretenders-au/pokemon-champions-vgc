import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePokemonList } from '@/features/pokemon/hooks/useDex';
import { useFormat } from '@/features/formats/FormatContext';
import { Icon } from '@/design-system/arena';
import PokemonImage from '@/components/atoms/PokemonImage';
import PokemonImagePicker from '@/features/scan/PokemonImagePicker';
import CropStep from '@/features/scan/CropStep';
import OneTapCaptureToggle from '@/features/scan/OneTapCaptureToggle';
import { useTeamScan } from '@/features/scan/useTeamScan';
import { filePickerSource, cameraSource } from '@/features/scan/captureSource';
import { normalizeImageBlob } from '@/features/scan/imageLoading';
import { saveBattleRoster } from '@/features/scan/battleRoster';
import {
  seedRoster,
  LOW_CONFIDENCE,
  availableCandidatesFor,
  opponentIdsFromEntries,
  unavailableIdsFor,
  updateEntryId,
  type ScanEntry,
} from '@/features/scan/roster';


const micro: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-inset)', border: '1px solid var(--line-2)', color: 'var(--ink-2)',
  fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
};

const HOW_IT_WORKS = [
  'Read the raw image pixels',
  'Detect the Team Preview layout',
  'Match each sprite to the Pokédex',
];

/**
 * ScanOpponentPage — the full-page opponent Team Preview scan (Turn 2 of the
 * Arena design). Upload a screenshot → confirm the six detected species →
 * save. Saving persists the roster (battleRoster) so future in-battle scans
 * match only those six; the calculator re-reads it on return.
 */
const ScanOpponentPage: React.FC = () => {
  const navigate = useNavigate();
  const { format } = useFormat();
  const pokemonList = usePokemonList(format);

  const legalIds = useMemo(() => new Set(pokemonList.map((p) => p.id)), [pokemonList]);
  const byId = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);
  const { status, slots, error, scan, reset } = useTeamScan(legalIds);

  const [roster, setRoster] = useState<ScanEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [cropping, setCropping] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed the editable roster from the opponent slots once a scan completes.
  useEffect(() => {
    if (status !== 'done') return;
    const nextRoster = seedRoster(slots).filter((e) => e.side !== 'player');
    setRoster(nextRoster);
    const flagged = nextRoster.findIndex((entry) => {
      const score = entry.candidates.find((candidate) => candidate.id === entry.id)?.score ?? 0;
      return score < LOW_CONFIDENCE;
    });
    setSelected(flagged >= 0 ? flagged : 0);
    setPickerOpen(false);
  }, [status, slots]);

  const runScan = async (blob: Blob) => {
    blob = await normalizeImageBlob(blob); // dropped/pasted HEIC -> displayable PNG
    setPendingBlob(blob); setSaved(false); await scan(blob);
  };
  const pickFile = async () => { const f = await filePickerSource.capture(); if (f) await runScan(f.blob); };
  const pickCamera = async () => { const f = await cameraSource.capture(); if (f) await runScan(f.blob); };
  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'));
        if (type) { await runScan(await it.getType(type)); return; }
      }
    } catch { /* clipboard unavailable / denied — use a button instead */ }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) void runScan(file);
  };

  const setEntryId = (index: number, id: number | null) =>
    setRoster((entries) => updateEntryId(entries, index, id));

  const selectedCandidates = useMemo(
    () => availableCandidatesFor(roster, selected),
    [roster, selected],
  );
  const disabledPickerIds = useMemo(
    () => unavailableIdsFor(roster, selected),
    [roster, selected],
  );

  const confirmAndSave = () => {
    const ids = opponentIdsFromEntries(roster);
    if (ids.length === 0) return;
    saveBattleRoster(ids);
    setSaved(true);
  };

  const restart = () => { reset(); setRoster([]); setPendingBlob(null); setCropping(false); setSaved(false); };
  const step = status === 'done' && !error ? 'confirm' : status === 'scanning' ? 'detect' : 'upload';
  const stepIdx = step === 'confirm' ? 1 : 0;
  const showBack = step !== 'upload' && !saved;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)' }}>
      {/* top bar: title + stepper */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-1)' }}>
        <button onClick={() => navigate('/')} aria-label="Back to calculator" style={{ width: 30, height: 30, flex: 'none', borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid var(--line-1)', color: 'var(--ink-2)', cursor: 'pointer' }}>
          <Icon name="chevron-right" size={16} color="var(--ink-2)" style={{ transform: 'scaleX(-1)' }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <Icon name="scan-line" size={18} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>Scan opponent team</span>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {['Upload', 'Confirm'].map((label, i) => {
            const state = i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'todo';
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 999, background: state === 'active' ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${state === 'active' ? 'var(--accent-soft-line)' : 'transparent'}` }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: state === 'todo' ? 'var(--ink-4)' : '#0a0f1a', background: state === 'todo' ? 'transparent' : state === 'done' ? 'var(--safe)' : 'var(--accent)', border: state === 'todo' ? '1px solid var(--line-2)' : 'none' }}>
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: state === 'active' ? 'var(--accent)' : state === 'done' ? 'var(--ink-2)' : 'var(--ink-4)' }}>{label}</span>
                </div>
                {i === 0 && <span style={{ width: 16, height: 1, background: 'var(--line-2)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '14px 16px' }}>
        {cropping && pendingBlob ? (
          <CropStep blob={pendingBlob} onCropped={(b) => { setCropping(false); void runScan(b); }} onCancel={() => setCropping(false)} />
        ) : step === 'upload' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, height: '100%' }}>
            <button
              onClick={pickFile}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 18, borderRadius: 'var(--r-lg)', background: 'var(--surface-card)', border: '1.5px dashed var(--line-3)', cursor: 'pointer', textAlign: 'center' }}
            >
              <div style={{ width: 60, height: 60, borderRadius: 'var(--r-md)', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-line)' }}>
                <Icon name="upload" size={28} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Import Team Preview screenshot</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Drag an image here, or use</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={ghostBtn} onClick={(e) => { e.stopPropagation(); void pasteImage(); }}><Icon name="clipboard" size={14} color="var(--ink-2)" />Paste</span>
                <span style={ghostBtn} onClick={(e) => { e.stopPropagation(); void pickCamera(); }}><Icon name="camera" size={14} color="var(--ink-2)" />Camera</span>
                <span style={ghostBtn} onClick={(e) => { e.stopPropagation(); void pickFile(); }}><Icon name="upload" size={14} color="var(--ink-2)" />Choose file</span>
              </div>
            </button>
            <div>
              <div style={{ ...micro, marginBottom: 8 }}>How it works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {HOW_IT_WORKS.map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.3 }}>{text}</span>
                  </div>
                ))}
              </div>
              {/* Android only (renders null elsewhere): starts the floating-bubble
                  overlay session — the mobile UI's sole path to the toggle. */}
              <div style={{ marginTop: 14 }}>
                <OneTapCaptureToggle />
              </div>
            </div>
          </div>
        ) : step === 'detect' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, border: '4px solid var(--line-1)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Reading the screenshot… this can take a few seconds.</div>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        ) : saved ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, height: '100%', textAlign: 'center', padding: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--safe-soft)', border: '1px solid var(--safe-line)' }}>
              <Icon name="check" size={28} color="var(--safe)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>Opponent team saved</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5, maxWidth: 360 }}>In-battle scans are now restricted to these {opponentIdsFromEntries(roster).length} species.</div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
              {roster.filter((e) => e.id != null).map((e, i) => (
                <div key={i} style={{ width: 40, height: 40, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', border: '1px solid var(--danger-line)', overflow: 'hidden' }}>
                  <PokemonImage id={e.id as number} name={byId.get(e.id as number)?.nameEn ?? 'pokemon'} className="w-9 h-9" />
                </div>
              ))}
            </div>
          </div>
        ) : roster.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', textAlign: 'center' }}>
            <Icon name="alert-triangle" size={26} color="var(--field)" />
            <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 380 }}>
              {error ? `Scan failed: ${error}` : "Couldn't detect a team. Try a clearer Team Preview screenshot, or crop around the six cards."}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={ghostBtn} onClick={restart}>Try another</button>
              {pendingBlob && <button style={ghostBtn} onClick={() => setCropping(true)}>Crop image</button>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 14, height: '100%', minHeight: 0 }}>
            {/* detected grid — scrolls independently of the fix panel */}
            <div style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={micro}>Detected team</div>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>Tap a card to review</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {roster.map((e, i) => {
                  const top = e.candidates.find((c) => c.id === e.id) ?? e.candidates[0];
                  const score = top?.score ?? 0;
                  const manual = e.id != null && !e.candidates.some((c) => c.id === e.id);
                  const low = !manual && score < LOW_CONFIDENCE;
                  const sel = i === selected;
                  const fg = low ? 'var(--field)' : manual ? 'var(--accent)' : 'var(--safe)';
                  const bg = low ? 'var(--field-soft)' : manual ? 'var(--accent-soft)' : 'var(--safe-soft)';
                  const line = low ? 'var(--field-line)' : manual ? 'var(--accent-soft-line)' : 'var(--safe-line)';
                  const name = e.id != null ? byId.get(e.id)?.nameEn ?? '—' : '—';
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelected(i); setPickerOpen(false); }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, borderRadius: 'var(--r-md)', cursor: 'pointer', background: sel ? 'var(--accent-soft)' : 'var(--surface-card)', border: `1px solid ${sel ? 'var(--accent-soft-line)' : 'var(--line-1)'}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: fg, background: bg, border: `1px solid ${line}` }}>{manual ? 'Set' : `${Math.round(score * 100)}%`}</span>
                        <Icon name={low ? 'alert-triangle' : 'check'} size={13} color={fg} />
                      </div>
                      <div style={{ width: '100%', height: 52, display: 'grid', placeItems: 'center', margin: '2px 0' }}>
                        {e.id != null ? <PokemonImage id={e.id} name={name} className="w-12 h-12" /> : <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--surface-inset)' }} />}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* fix-detection panel for the selected slot — scrolls independently */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="scan-line" size={15} color="var(--accent)" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Fix detection</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-inset)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '2px 8px' }}>Slot {selected + 1}</span>
              </div>

              <div style={micro}>Top candidates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedCandidates.length === 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>No suggestions — type a name below.</div>
                )}
                {selectedCandidates.map((c) => {
                  const on = roster[selected]?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setEntryId(selected, c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'var(--surface-inset)', border: `1px solid ${on ? 'var(--accent-soft-line)' : 'var(--line-1)'}` }}
                    >
                      <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'grid', placeItems: 'center', border: `2px solid ${on ? 'var(--accent)' : 'var(--line-3)'}` }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? 'var(--accent)' : 'transparent' }} />
                      </span>
                      <div style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface-inset)', borderRadius: 8, overflow: 'hidden' }}>
                        <PokemonImage id={c.id} name={byId.get(c.id)?.nameEn ?? 'pokemon'} className="w-8 h-8" />
                      </div>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)', textAlign: 'left' }}>{byId.get(c.id)?.nameEn ?? '—'}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: c.score >= 0.6 ? 'var(--safe)' : c.score >= 0.2 ? 'var(--field)' : 'var(--ink-4)' }}>{Math.round(c.score * 100)}%</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ ...micro, marginTop: 2 }}>Or type a name</div>
              {pickerOpen ? (
                <PokemonImagePicker
                  pokemonList={pokemonList}
                  selectedId={roster[selected]?.id ?? null}
                  disabledIds={disabledPickerIds}
                  onSelect={(id) => { setEntryId(selected, id); setPickerOpen(false); }}
                />
              ) : (
                <button style={{ ...ghostBtn, justifyContent: 'center', minHeight: 36 }} onClick={() => setPickerOpen(true)}>Search the Pokédex</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* pinned footer */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--line-1)', background: 'var(--surface-sticky)' }}>
        {showBack && (
          <button onClick={restart} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <Icon name="chevron-right" size={15} color="var(--ink-2)" style={{ transform: 'scaleX(-1)' }} />Back
          </button>
        )}
        <span style={{ flex: 1 }} />
        {saved ? (
          <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: '#0a0f1a', background: 'var(--safe)' }}>
            <Icon name="check" size={16} color="#0a0f1a" />Done
          </button>
        ) : step === 'confirm' && roster.length > 0 ? (
          <button onClick={confirmAndSave} disabled={opponentIdsFromEntries(roster).length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: '#0a0f1a', background: 'var(--accent)', opacity: opponentIdsFromEntries(roster).length === 0 ? 0.5 : 1 }}>
            <Icon name="check" size={16} color="#0a0f1a" />Confirm &amp; save
          </button>
        ) : step === 'upload' ? (
          <button onClick={pickFile} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: '#0a0f1a', background: 'var(--accent)' }}>
            <Icon name="scan-line" size={16} color="#0a0f1a" />Scan screenshot
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ScanOpponentPage;
