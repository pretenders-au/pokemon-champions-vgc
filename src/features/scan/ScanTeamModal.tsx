import React, { useMemo, useState } from 'react';
import Modal from '@/components/atoms/Modal';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import { Button, Chip } from '@/design-system/arena';
import { useTeamScan, type ScanEngine } from './useTeamScan';
import type { LegalIdsBySide } from './scanFrame';
import { loadClassifier } from './classifier';
import { filePickerSource, cameraSource } from './captureSource';
import { toParsedSets } from './toParsedSets';
import { formFamilyIds, buildLegalIdsResolver } from './battleRoster';
import { seedRoster, opponentIdsFromEntries, updateEntryId, type ScanEntry } from './roster';
import CropStep from './CropStep';
import ScanConfirmView from './ScanConfirmView';

/**
 * Which screen opened the modal, and what it will do with the result. Two hosts exist:
 * the Teams page turns a scan into a Team, the calculator loads sides and confirms a
 * Battle roster. Naming the host is what makes each action's presence a fact rather than
 * an inference from which callbacks happened to be passed.
 *
 * Distinct from the *scan* mode (`useTeamScan`'s `mode`), which is decided by the image.
 */
export type ScanHost =
  | {
      kind: 'import';
      /** Turn the scanned opponent roster into a new Team. */
      onImport: (sets: ParsedShowdownSet[]) => void;
    }
  | {
      kind: 'calc';
      /** Load an opponent entry into the calculator's defender side. */
      onLoadDefender: (pokemonId: number, opts?: { hpPercent?: number | null }) => void;
      /** Load a player entry (battle scans only) into the attacker side. */
      onLoadAttacker: (pokemonId: number, opts?: { hpPercent?: number | null }) => void;
      /** Save the scanned opponent roster as a Team, without leaving the calculator. */
      onSaveTeam: (sets: ParsedShowdownSet[]) => void;
      /** Confirm the scanned opponent species as the Battle roster (team scans only). */
      onConfirmRoster: (ids: number[]) => void;
      /** Confirmed opponent ids — battle scans mask opponent tiles to their form families. */
      battleRoster: number[] | null;
      /** The user's own team's species ids — battle scans mask PLAYER tiles likewise. */
      myTeamIds: number[] | null;
    };

interface ScanTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  pokemonList: PokemonBaseStats[];
  host: ScanHost;
}

const ScanTeamModal: React.FC<ScanTeamModalProps> = ({ isOpen, onClose, pokemonList, host }) => {
  // Narrowed once, so every host-specific affordance below tests one thing.
  const calc = host.kind === 'calc' ? host : null;
  const imp = host.kind === 'import' ? host : null;
  const battleRoster = calc?.battleRoster ?? null;
  const myTeamIds = calc?.myTeamIds ?? null;
  const fullLegalIds = useMemo(() => new Set(pokemonList.map((p) => p.id)), [pokemonList]);
  const maskIds = useMemo(
    () => (battleRoster && battleRoster.length > 0 ? formFamilyIds(battleRoster, pokemonList) : null),
    [battleRoster, pokemonList],
  );
  const myMaskIds = useMemo(
    () => (myTeamIds && myTeamIds.length > 0 ? formFamilyIds(myTeamIds, pokemonList) : null),
    [myTeamIds, pokemonList],
  );
  // Central mask policy (tested in battleRoster.test.ts): battle-mode
  // opponent tiles -> roster family, battle-mode player tiles -> my-team
  // family, everything else (team preview, legacy) -> the full format set.
  const legalIds = useMemo<LegalIdsBySide>(
    () => buildLegalIdsResolver(fullLegalIds, maskIds, myMaskIds),
    [fullLegalIds, maskIds, myMaskIds],
  );
  const byId = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);
  const { status, slots, mode, error, scan, reset } = useTeamScan(legalIds);
  // Dev hook so a blob can be fed through the real pipeline from the console
  // (same pattern as ArenaPlayerScanReview's __playerScanDebug).
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scanTeamDebug = { scan };
  // Editable roster, decoupled from the raw scan slots so the user can add/remove entries.
  const [roster, setRoster] = useState<ScanEntry[]>([]);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [cropping, setCropping] = useState(false);
  const [engine, setEngine] = useState<ScanEngine>(
    () => (localStorage.getItem('scan.engine') as ScanEngine | null) ?? 'auto',
  );

  // Warm up the classifier as soon as the modal opens so load success/failure logs
  // land in the console before the first scan runs.
  React.useEffect(() => {
    if (isOpen) void loadClassifier();
  }, [isOpen]);

  const changeEngine = (value: ScanEngine) => {
    setEngine(value);
    localStorage.setItem('scan.engine', value);
  };

  const startPick = async () => {
    const frame = await filePickerSource.capture();
    if (frame) {
      setPendingBlob(frame.blob);
      await scan(frame.blob);
    }
  };

  const startCamera = async () => {
    const frame = await cameraSource.capture();
    if (frame) {
      setPendingBlob(frame.blob);
      await scan(frame.blob);
    }
  };

  // Seed the editable roster from the scan results once a scan completes.
  React.useEffect(() => {
    if (status === 'done') setRoster(seedRoster(slots));
  }, [status, slots]);

  const setEntryId = (i: number, id: number | null) => setRoster((r) => updateEntryId(r, i, id));
  const removeEntry = (i: number) => setRoster((r) => r.filter((_, idx) => idx !== i));
  const addEntry = () => setRoster((r) => [...r, { id: null, candidates: [] }]);

  // Import/save build the OPPONENT's roster — player-side entries from battle
  // scans must not leak into it (entries added by hand have no side).
  const rosterNames = () =>
    roster
      .filter((e) => e.side !== 'player')
      .map((e) => (e.id != null ? byId.get(e.id)?.nameEn : undefined))
      .filter((n): n is string => !!n);

  const confirm = () => {
    const names = rosterNames();
    if (names.length === 0 || !imp) return;
    imp.onImport(toParsedSets(names));
    handleClose();
  };

  const saveTeam = () => {
    const names = rosterNames();
    if (names.length === 0 || !calc) return;
    calc.onSaveTeam(toParsedSets(names));
  };

  const confirmRosterIds = () => opponentIdsFromEntries(roster);

  const confirmRoster = () => {
    const ids = confirmRosterIds();
    if (ids.length === 0 || !calc) return;
    calc.onConfirmRoster(ids);
    handleClose();
  };

  // A Battle roster is six confirmed species, so only a team preview can produce one — a
  // battle screen shows who is out right now. Both the player-row filter and the confirm
  // button turn on exactly this.
  const confirmsRoster = calc !== null && mode !== 'battle';

  const handleClose = () => {
    reset();
    setRoster([]);
    setPendingBlob(null);
    setCropping(false);
    onClose();
  };

  // Team scans hide the player's own column — only the opponent's roster is the
  // user's business here. Battle scans show both sides. (Same rule as before the
  // Arena confirm-view redesign; the grid itself caps display at 6.)
  const visibleIndexes = roster
    .map((_, i) => i)
    .filter((i) => !(confirmsRoster && roster[i].side === 'player'));

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={mode === 'battle' ? 'Scan battle' : 'Scan opponent team'} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {status === 'idle' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded bg-accent text-accent-ink hover:bg-accent-hover transition-colors" onClick={startPick}>
                Choose screenshot
              </button>
              <button className="px-4 py-2 rounded bg-accent text-accent-ink hover:bg-accent-hover transition-colors" onClick={startCamera}>
                Take photo
              </button>
            </div>
            <p className="text-sm text-ink-3">Tip: hold the phone parallel to the screen and avoid glare.</p>
          </div>
        )}

        {status === 'scanning' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
            <p className="text-sm text-ink-2">Recognizing team… this can take a few seconds.</p>
          </div>
        )}

        {status === 'error' && <p className="text-danger">Scan failed: {error}</p>}

        {status === 'done' && cropping && pendingBlob && (
          <CropStep
            blob={pendingBlob}
            onCropped={(b) => { setCropping(false); setPendingBlob(b); scan(b); }}
            onCancel={() => setCropping(false)}
          />
        )}

        {status === 'done' && !cropping && (
          <>
            {slots.length === 0 && (
              <p className="text-field text-sm">
                Couldn't auto-detect any Pokémon. Add them manually below, or
                <button className="ml-1 underline" onClick={startPick}>try another image</button>.
                {pendingBlob && (
                  <button className="ml-1 underline font-semibold" onClick={() => setCropping(true)}>
                    Crop around the game area
                  </button>
                )}
              </p>
            )}
            {/* A battle screen has at most 4 nameplates (and hidden player plates are
                normal), so the too-few warning only applies to team scans — and it
                counts the OPPONENT's entries, since player slots also fill the list. */}
            {mode !== 'battle' && slots.length > 0 && slots.filter((s) => s.side !== 'player').length < 6 && pendingBlob && (
              <p className="text-field text-sm">
                Couldn't find all 6 —
                <button className="ml-1 underline font-semibold" onClick={() => setCropping(true)}>
                  crop around the opponent's red column
                </button>.
              </p>
            )}

            <div style={{ minHeight: 360 }}>
              <ScanConfirmView
                entries={roster}
                indexes={visibleIndexes}
                pokemonList={pokemonList}
                onPick={setEntryId}
                size="roomy"
                onRescan={startPick}
                showSides={mode === 'battle'}
                onAddSlot={addEntry}
                renderSlotActions={(i) => {
                  const entry = roster[i];
                  if (!entry) return null;
                  return (
                    <>
                      {calc && entry.side !== 'player' && (
                        <Button
                          variant="secondary" size="sm" disabled={entry.id == null}
                          onClick={() => entry.id != null && calc.onLoadDefender(entry.id, { hpPercent: entry.hpPercent })}
                        >
                          Set as defender
                        </Button>
                      )}
                      {calc && entry.side === 'player' && (
                        <Button
                          variant="secondary" size="sm" disabled={entry.id == null}
                          onClick={() => entry.id != null && calc.onLoadAttacker(entry.id, { hpPercent: entry.hpPercent })}
                        >
                          Set as attacker
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeEntry(i)}>Remove</Button>
                    </>
                  );
                }}
              />
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-3">
              {(['auto', 'classifier', 'descriptor'] as ScanEngine[]).map((e) => (
                <Chip key={e} active={engine === e} onClick={() => changeEngine(e)} style={{ height: 28, fontSize: 12 }}>
                  {e}
                </Chip>
              ))}
              {pendingBlob && (
                <Button variant="ghost" size="sm" onClick={() => setCropping(true)}>Crop image &amp; retry</Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                {calc && (
                  <Button variant="secondary" onClick={saveTeam} disabled={roster.every((e) => e.id == null)}>
                    Save opp team to Teams
                  </Button>
                )}
                {confirmsRoster && (
                  <Button onClick={confirmRoster} disabled={confirmRosterIds().length === 0}>
                    Confirm opponent team
                  </Button>
                )}
                {imp && (
                  <Button onClick={confirm} disabled={roster.every((e) => e.id == null)}>
                    Create team
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ScanTeamModal;
