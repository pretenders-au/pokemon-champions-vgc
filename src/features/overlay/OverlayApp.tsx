// Overlay shell (#/overlay): the only page the panel WebView renders.
// Bubble tap: roster locked -> open the calculator directly; otherwise
// capture + scan for a team preview. Native only captures frames and
// moves windows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { overlayBridge } from './overlayBridge';
import { routeScan } from './overlayScan';
import { usePokemonList, useMoveList } from '@/features/pokemon/hooks/useDex';
import StripView from './StripView';
import ConfirmRosterView from './ConfirmRosterView';
import DamageCalculatorPage, { type OverlayDefender } from '@/pages/DamageCalculator';
import { Icon } from '@/design-system/arena';
import { useFormat } from '../formats/FormatContext';
import { useBattleRoster } from '../scan/useBattleRoster';
import { formFamilyIds, buildLegalIdsResolver, readBattleRoster } from '../scan/battleRoster';
import { scanFrame, DEFAULT_DEPS } from '../scan/scanFrame';
import type { SlotResult } from '../scan/types';
import { ArenaPlayerScanReview } from '../scan/ArenaPlayerScanReview';
import { detectPlayerPanels } from '../scan/playerPanels';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useViewportMode } from '@/hooks/useViewportMode';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';

type View = 'idle' | 'scanning' | 'confirm' | 'calc' | 'error' | 'playerScan' | 'playerSaved';

const OverlayApp: React.FC = () => {
  const { format } = useFormat();
  const pokemonList = usePokemonList(format);
  const { roster, confirmRoster } = useBattleRoster();
  const moveList = useMoveList();
  // Restore-from-localStorage inside useTeams hydrates this WebView's in-memory
  // DB with existing teams BEFORE any save — otherwise the persist effect would
  // clobber localStorage['vgc_teams'] with only the new team.
  const { createTeam } = useTeams();
  const [playerFrame, setPlayerFrame] = useState<{ blob: Blob; seq: number } | null>(null);
  // The overlay panel has its own viewport, so the layout it hands the review card is read
  // here rather than assumed — a phone-sized panel and a landscape one differ.
  const portrait = useViewportMode() === 'arena';
  const [view, setView] = useState<View>('idle');
  const [errorReason, setErrorReason] = useState<'empty' | 'battle'>('empty');
  const [confirmSlots, setConfirmSlots] = useState<SlotResult[]>([]);
  const [scanSeq, setScanSeq] = useState(0);
  const [overlayDefender, setOverlayDefender] = useState<OverlayDefender | null>(null);
  // Hold-to-peek: the calc panel goes fully transparent while the button is held.
  const [peeking, setPeeking] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savingRef = useRef(false);
  const pendingBlob = useRef<Blob | null>(null);
  const seqRef = useRef(0); // monotonic key/remount counter; no setState inside updaters
  const byId = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);

  // Mount: reflect persisted roster state to the native bubble/window.
  useEffect(() => {
    overlayBridge.setBubbleTag(roster ? 'calc' : 'scan');
    overlayBridge.setWindowState(roster ? 'strip' : 'hidden');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The native panel window is transparent; the page background must be too,
  // so the game stays visible around partial-width panels (confirm view).
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
  }, []);

  const closePanel = useCallback(() => {
    setView('idle');
    // Fresh read (spec): roster changes made in the main app or via the
    // chips' clear button self-correct here — window AND bubble tag.
    const locked = !!readBattleRoster();
    overlayBridge.setWindowState(locked ? 'strip' : 'hidden');
    overlayBridge.setBubbleTag(locked ? 'calc' : 'scan');
  }, []);

  // Minimize, don't destroy: the scan state must survive while the user flips
  // the game to the other team screen; a bubble tap re-opens + adds the frame.
  const minimizePlayerScan = useCallback(() => {
    overlayBridge.setWindowState('hidden');
    overlayBridge.setBubbleTag('scan');
  }, []);

  const cancelPlayerScan = useCallback(() => {
    setPlayerFrame(null);
    setSaveError(false);
    closePanel();
  }, [closePanel]);

  const handlePlayerSave = useCallback(async (members: PokemonConfig[]) => {
    if (savingRef.current) return;
    if (members.length === 0) return;
    savingRef.current = true;
    setSaveError(false);
    const first = pokemonList.find((p) => p.id === members[0].selectedId);
    try {
      await createTeam(`${first?.nameEn ?? 'Scanned'}'s Team`, members);
      setPlayerFrame(null);
      setView('playerSaved');
    } catch (e) {
      console.error('[overlay] save team failed', e);
      setSaveError(true);
    } finally {
      savingRef.current = false;
    }
  }, [pokemonList, createTeam]);

  const runScan = useCallback(async (blob: Blob | null) => {
    overlayBridge.setWindowState('panel');
    if (!blob) { setErrorReason('empty'); setView('error'); return; }
    if (pokemonList.length === 0) { pendingBlob.current = blob; setView('scanning'); return; }
    setView('scanning');
    try {
      const image = await DEFAULT_DEPS.blobToRgbaImage(blob);
      // "Replicate This Battle Team?" screens (2x3 purple panel grid) route to
      // the my-team scan; team-preview/battle frames fall through to scanFrame.
      if (detectPlayerPanels(image)) {
        seqRef.current += 1;
        setPlayerFrame({ blob, seq: seqRef.current });
        setView('playerScan');
        return;
      }
      const fullLegal = new Set(pokemonList.map((p) => p.id));
      // Fresh read (spec): re-read the roster on every tap, not hook state.
      const lockedRoster = readBattleRoster();
      const maskIds = lockedRoster && lockedRoster.length > 0 ? formFamilyIds(lockedRoster, pokemonList) : null;
      const legal = buildLegalIdsResolver(fullLegal, maskIds, null);
      const { mode, slots } = await scanFrame(image, legal, DEFAULT_DEPS);
      const route = routeScan(mode, slots);
      if (route.view === 'confirm') {
        setConfirmSlots(route.slots);
        seqRef.current += 1;
        setScanSeq(seqRef.current);
        setView('confirm');
      } else {
        setErrorReason(route.reason);
        setView('error');
      }
    } catch (e) {
      console.error('[overlay] scan failed', e);
      setErrorReason('empty');
      setView('error');
    }
  }, [pokemonList]);

  // A tap can land before sql.js finishes loading; finish it when data is up.
  useEffect(() => {
    if (pokemonList.length > 0 && pendingBlob.current) {
      const blob = pendingBlob.current;
      pendingBlob.current = null;
      void runScan(blob);
    }
  }, [pokemonList, runScan]);

  // Roster locked -> the bubble is a calculator shortcut: open instantly, no
  // capture. In-battle scanning (species + HP) was removed — not accurate
  // enough (2026-07-12). No roster -> scan; the frame routes by screen type.
  // While the my-team scan is open (possibly minimized so the user can flip
  // the game to its other team screen), a tap adds the frame to THAT scan.
  useEffect(() => overlayBridge.onBubbleTap(() => {
    if (view === 'playerScan') {
      const blob = overlayBridge.blinkAndCapture();
      if (blob) { seqRef.current += 1; setPlayerFrame({ blob, seq: seqRef.current }); }
      overlayBridge.setWindowState('panel');
      return;
    }
    if (readBattleRoster()) {
      setView('calc');
      overlayBridge.setWindowState('panel');
    } else {
      void runScan(overlayBridge.blinkAndCapture());
    }
  }), [view, runScan]);
  useEffect(() => overlayBridge.onBack(view === 'playerScan' ? minimizePlayerScan : closePanel), [view, closePanel, minimizePlayerScan]);

  const rescan = useCallback(() => void runScan(overlayBridge.blinkAndCapture()), [runScan]);

  // Double-tap the bubble: rescan the screen. runScan auto-routes the frame —
  // opponent team-preview -> confirm, own "Replicate This Team?" -> my-team scan.
  useEffect(() => overlayBridge.onBubbleDoubleTap(rescan), [rescan]);

  const handleConfirm = useCallback((ids: number[]) => {
    confirmRoster(ids);
    overlayBridge.setBubbleTag('calc');
    overlayBridge.setWindowState('strip');
    setView('idle');
  }, [confirmRoster]);

  const handleStripPick = useCallback((id: number) => {
    seqRef.current += 1;
    setOverlayDefender({ id, hpPercent: null, seq: seqRef.current });
    setScanSeq(seqRef.current);
    setView('calc');
    overlayBridge.setWindowState('panel');
  }, []);

  if (view === 'idle') {
    return roster ? (
      <StripView roster={roster} byId={byId} activeId={overlayDefender?.id ?? null} onPick={handleStripPick} />
    ) : null;
  }

  if (view === 'scanning') {
    return (
      <div className="w-full h-screen grid place-items-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
        <div className="px-4 py-2 rounded-lg text-sm font-semibold animate-pulse" style={{ background: 'var(--surface-card)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}>
          Scanning…
        </div>
      </div>
    );
  }

  if (view === 'confirm') {
    return (
      <div className="w-full h-screen flex p-2" onClick={closePanel}>
        <div className="w-2/3 h-full rounded-2xl overflow-hidden shadow-2xl" style={{ border: '1px solid var(--line-2)' }} onClick={(e) => e.stopPropagation()}>
          <ConfirmRosterView
            key={scanSeq}
            slots={confirmSlots}
            pokemonList={pokemonList}
            onConfirm={handleConfirm}
            onRescan={rescan}
            onClose={closePanel}
          />
        </div>
      </div>
    );
  }

  if (view === 'playerScan' || view === 'playerSaved') {
    return (
      /* Backdrop tap MINIMIZES during a scan (state must survive the two-screen flow) — unlike calc, where it closes. */
      <div className="w-full h-screen p-2" onClick={view === 'playerScan' ? minimizePlayerScan : cancelPlayerScan}>
        <div
          className="w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-page)', border: '1px solid var(--line-2)', opacity: peeking ? 0 : 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-3 h-8 shrink-0" style={{ borderBottom: '1px solid var(--line-1)', color: 'var(--ink-1)' }}>
            <Icon name="scan-line" size={14} color="var(--accent)" />
            <span className="text-xs font-bold">Scan my team</span>
            <span className="flex-1" />
            {view === 'playerScan' && (
              <>
                <button
                  aria-label="Hold to peek at the game"
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setPeeking(true); }}
                  onPointerUp={() => setPeeking(false)}
                  onPointerCancel={() => setPeeking(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="text-[11px] px-2 py-1 rounded inline-flex items-center gap-1"
                  style={{ border: '1px solid var(--line-2)', background: 'var(--surface-inset)', color: 'var(--ink-2)', touchAction: 'none' }}
                >
                  <Icon name="eye" size={12} color="var(--ink-2)" />Peek
                </button>
                <button aria-label="Minimize" onClick={minimizePlayerScan} className="text-[11px] px-2 py-1 rounded" style={{ border: '1px solid var(--line-2)', background: 'var(--surface-inset)', color: 'var(--ink-2)' }}>
                  ▾
                </button>
              </>
            )}
          </div>
          {view === 'playerSaved' ? (
            <div className="flex-1 min-h-0 grid place-items-center p-3">
              <div className="text-center space-y-3">
                <div className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>Team saved</div>
                <div className="text-xs" style={{ color: 'var(--ink-3)' }}>Find it on the Teams page — moves, item and EVs included.</div>
                <button onClick={cancelPlayerScan} className="h-9 px-5 rounded-lg font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--navy-900)' }}>Done</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {saveError && (
                <p className="text-sm px-3 pt-2 shrink-0" style={{ color: 'var(--danger)' }} role="alert">
                  Saving failed — try again.
                </p>
              )}
              <div className="flex-1 min-h-0">
                <ArenaPlayerScanReview
                  portrait={portrait}
                  pokemonList={pokemonList}
                  moveList={moveList}
                  sources={[]}
                  hint="Scanned from the game's team screens. To add the other screen (moves or stats), minimize this panel (▾), flip the screen in-game, and tap the bubble again."
                  frame={playerFrame}
                  onSave={(members) => void handlePlayerSave(members)}
                  onCancel={cancelPlayerScan}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'calc') {
    return (
      <div className="w-full h-screen p-2" onClick={closePanel}>
        <div
          className="w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-page)', border: '1px solid var(--line-2)', opacity: peeking ? 0 : 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-3 h-8 shrink-0" style={{ borderBottom: '1px solid var(--line-1)', color: 'var(--ink-1)' }}>
            <span className="text-xs font-bold">Damage · floating over battle</span>
            <span className="flex-1" />
            <button
              aria-label="Scan new team"
              onClick={rescan}
              className="text-[11px] px-2 py-1 rounded inline-flex items-center gap-1"
              style={{ border: '1px solid var(--line-2)', background: 'var(--surface-inset)', color: 'var(--ink-2)' }}
            >
              <Icon name="scan-line" size={12} color="var(--ink-2)" />Scan new team
            </button>
            <button
              aria-label="Hold to peek at the game"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setPeeking(true); }}
              onPointerUp={() => setPeeking(false)}
              onPointerCancel={() => setPeeking(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="text-[11px] px-2 py-1 rounded inline-flex items-center gap-1"
              style={{ border: '1px solid var(--line-2)', background: 'var(--surface-inset)', color: 'var(--ink-2)', touchAction: 'none' }}
            >
              <Icon name="eye" size={12} color="var(--ink-2)" />Peek
            </button>
            <button aria-label="Minimize" onClick={closePanel} className="text-[11px] px-2 py-1 rounded" style={{ border: '1px solid var(--line-2)', background: 'var(--surface-inset)', color: 'var(--ink-2)' }}>
              ▾
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <DamageCalculatorPage overlayDefender={overlayDefender} overlayHosted />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen grid place-items-center" onClick={closePanel}>
      <div className="w-72 p-4 rounded-xl shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold mb-1">Couldn't read the screen</div>
        <div className="text-xs mb-3" style={{ color: 'var(--ink-3)' }}>
          {errorReason === 'battle'
            ? 'That looks like a battle — scanning works on the team-select screen at the start of a game.'
            : 'Point at the team-select screen and retry.'}
        </div>
        <div className="flex gap-2">
          <button onClick={rescan} className="flex-1 h-9 rounded-lg font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--navy-900)' }}>Retry</button>
          <button onClick={closePanel} className="flex-1 h-9 rounded-lg font-bold text-sm" style={{ border: '1px solid var(--line-2)', color: 'var(--ink-2)' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default OverlayApp;
