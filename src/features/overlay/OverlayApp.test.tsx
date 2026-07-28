// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';

const mon = (id: number, nameEn: string) => ({ id, nameEn, identifier: nameEn.toLowerCase() } as PokemonBaseStats);

const bridgeMock = vi.hoisted(() => ({
  isAvailable: () => true,
  blinkAndCapture: vi.fn((): Blob | null => new Blob(['x'], { type: 'image/png' })),
  setWindowState: vi.fn(),
  setBubbleTag: vi.fn(),
  onBubbleTap: vi.fn((cb: () => void) => { (globalThis as any).__tap = cb; return () => {}; }),
  onBubbleDoubleTap: vi.fn((cb: () => void) => { (globalThis as any).__doubleTap = cb; return () => {}; }),
  onBack: vi.fn((cb: () => void) => { (globalThis as any).__back = cb; return () => {}; }),
}));
const scanFrameMock = vi.hoisted(() => vi.fn());
const detectPlayerPanelsMock = vi.hoisted(() => vi.fn((): unknown => null));
const createTeamMock = vi.hoisted(() => vi.fn(async () => 'team-1'));

vi.mock('./overlayBridge', () => ({ overlayBridge: bridgeMock }));
vi.mock('@/features/pokemon/hooks/useDex', () => ({
  usePokemonList: () => [mon(445, 'Garchomp'), mon(823, 'Corviknight')],
  useMoveList: () => [],
}));
vi.mock('../formats/FormatContext', () => ({ useFormat: () => ({ format: 'reg-h' }) }));
vi.mock('../scan/scanFrame', async (importOriginal) => {
  const orig = await importOriginal<any>();
  return {
    ...orig,
    scanFrame: scanFrameMock,
    // jsdom has no canvas/createImageBitmap — stub the decode step.
    DEFAULT_DEPS: { ...orig.DEFAULT_DEPS, blobToRgbaImage: async () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }) },
  };
});
vi.mock('../scan/playerPanels', () => ({ detectPlayerPanels: detectPlayerPanelsMock }));
vi.mock('@/features/teams/hooks/useTeams', () => ({
  useTeams: () => ({
    teams: [], loading: false, error: null,
    createTeam: createTeamMock,
    fetchTeams: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(), getTeam: vi.fn(),
  }),
}));
vi.mock('../scan/ArenaPlayerScanReview', () => ({
  ArenaPlayerScanReview: ({ onSave, onCancel, frame }: any) => (
    <div data-testid="player-scan" data-frame-seq={frame?.seq ?? 'none'}>
      <button onClick={() => onSave([{ selectedId: 445 }])}>save-stub</button>
      <button onClick={onCancel}>cancel-stub</button>
    </div>
  ),
}));
vi.mock('@/pages/DamageCalculator', () => ({
  default: ({ overlayDefender }: any) => <div data-testid="calc">{overlayDefender ? `${overlayDefender.id}:${String(overlayDefender.hpPercent)}` : 'no-defender'}</div>,
}));

import OverlayApp from './OverlayApp';

describe('OverlayApp', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); detectPlayerPanelsMock.mockReturnValue(null); });

  it('reflects a locked roster to native on mount (strip + calc tag)', () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    render(<OverlayApp />);
    expect(bridgeMock.setBubbleTag).toHaveBeenCalledWith('calc');
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('strip');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0); // strip tiles
  });

  it('bubble tap on a team-preview frame opens the confirm view', async () => {
    scanFrameMock.mockResolvedValue({ mode: 'team', slots: [{ box: { x: 0, y: 0, w: 1, h: 1 }, candidates: [{ id: 445, score: 0.9 }] }] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('panel');
    expect(await screen.findByText(/Confirm opponent roster/)).toBeTruthy();
  });

  it('bubble tap with the roster locked opens the calc instantly — no capture, no scan', async () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    expect(await screen.findByTestId('calc')).toBeTruthy();
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('panel');
    expect(bridgeMock.blinkAndCapture).not.toHaveBeenCalled();
    expect(scanFrameMock).not.toHaveBeenCalled();
  });

  it('double-tap with the roster locked rescans the screen and auto-routes an opponent team to confirm', async () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    scanFrameMock.mockResolvedValue({ mode: 'team', slots: [{ box: { x: 0, y: 0, w: 1, h: 1 }, candidates: [{ id: 445, score: 0.9 }] }] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__doubleTap(); });
    expect(bridgeMock.blinkAndCapture).toHaveBeenCalled();
    expect(await screen.findByText(/Confirm opponent roster/)).toBeTruthy();
  });

  it('double-tap on a my-team "Replicate This Team?" frame auto-routes to the my-team scan', async () => {
    detectPlayerPanelsMock.mockReturnValue({});
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__doubleTap(); });
    expect(bridgeMock.blinkAndCapture).toHaveBeenCalled();
    expect(await screen.findByText(/Scan my team/)).toBeTruthy();
    expect(scanFrameMock).not.toHaveBeenCalled();
  });

  it('battle frames are no longer scan-routed: no roster + battle frame -> error card', async () => {
    scanFrameMock.mockResolvedValue({
      mode: 'battle',
      slots: [{ box: { x: 100, y: 0, w: 1, h: 1 }, side: 'opponent', candidates: [{ id: 445, score: 0.9 }], hpPercent: 56 }],
    });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    expect(await screen.findByText(/That looks like a battle/)).toBeTruthy();
    expect(localStorage.getItem('scan.lastScanHp')).toBeNull();
  });

  it('strip pick opens the calc with the picked defender (no HP memory)', async () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    render(<OverlayApp />);
    fireEvent.click(screen.getByRole('button', { name: /Corviknight/ }));
    expect((await screen.findByTestId('calc')).textContent).toBe('823:null');
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('panel');
  });

  it('"Scan new team" from the calc scans the screen behind and opens confirm for the next roster', async () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    scanFrameMock.mockResolvedValue({ mode: 'team', slots: [{ box: { x: 0, y: 0, w: 1, h: 1 }, candidates: [{ id: 445, score: 0.9 }] }] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); }); // roster locked -> calc
    await screen.findByTestId('calc');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Scan new team/ })); });
    expect(bridgeMock.blinkAndCapture).toHaveBeenCalled();
    expect(await screen.findByText(/Confirm opponent roster/)).toBeTruthy();
  });

  it('unreadable frame shows the error card', async () => {
    scanFrameMock.mockResolvedValue({ mode: null, slots: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    expect(await screen.findByText(/Couldn't read the screen/)).toBeTruthy();
  });

  it('hold-to-peek hides the calc panel while pressed and restores it on release', async () => {
    localStorage.setItem('scan.battleRoster', JSON.stringify([445, 823]));
    const { container } = render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    const peek = await screen.findByRole('button', { name: /Hold to peek/ });
    const panel = container.querySelector('.rounded-2xl') as HTMLElement;
    fireEvent.pointerDown(peek);
    expect(panel.style.opacity).toBe('0');
    fireEvent.pointerUp(peek);
    expect(panel.style.opacity).toBe('1');
  });

  it('hold-to-peek hides the my-team scan panel while pressed and restores it on release', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    const { container } = render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    const peek = screen.getByRole('button', { name: /Hold to peek/ });
    const panel = container.querySelector('.rounded-2xl') as HTMLElement;
    fireEvent.pointerDown(peek);
    expect(panel.style.opacity).toBe('0');
    fireEvent.pointerUp(peek);
    expect(panel.style.opacity).toBe('1');
  });

  it('bubble tap on a player-team screen routes to the my-team scan, not scanFrame', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    const panel = await screen.findByTestId('player-scan');
    expect(panel.getAttribute('data-frame-seq')).not.toBe('none');
    expect(scanFrameMock).not.toHaveBeenCalled();
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('panel');
  });

  it('bubble tap while the my-team scan is open adds a frame instead of restarting', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    const seq1 = (await screen.findByTestId('player-scan')).getAttribute('data-frame-seq');
    await act(async () => { (globalThis as any).__tap(); });
    const seq2 = (await screen.findByTestId('player-scan')).getAttribute('data-frame-seq');
    expect(seq2).not.toBe(seq1); // new frame reached the SAME mounted panel
    expect(scanFrameMock).not.toHaveBeenCalled();
  });

  it('saving the scanned team creates it named after the first species and shows the saved card', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'save-stub' })); });
    expect(createTeamMock).toHaveBeenCalledWith("Garchomp's Team", [{ selectedId: 445 }]);
    expect(await screen.findByText('Team saved')).toBeTruthy();
  });

  it('cancelling the my-team scan closes the panel back to idle', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'cancel-stub' })); });
    expect(screen.queryByTestId('player-scan')).toBeNull();
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('hidden'); // no roster -> window hidden
  });

  it('native Back while the my-team scan is open minimizes instead of destroying it', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    await act(async () => { (globalThis as any).__back(); });
    // minimized: window hidden + bubble tagged scan, but the panel (and its scan state) stays mounted
    expect(bridgeMock.setWindowState).toHaveBeenCalledWith('hidden');
    expect(bridgeMock.setBubbleTag).toHaveBeenCalledWith('scan');
    expect(screen.getByTestId('player-scan')).toBeTruthy();
  });

  it('double-tapping save creates the team exactly once', async () => {
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    const save = screen.getByRole('button', { name: 'save-stub' });
    await act(async () => { fireEvent.click(save); fireEvent.click(save); });
    expect(createTeamMock).toHaveBeenCalledTimes(1);
  });

  it('a failed save shows an error and leaves the scan open for retry', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    detectPlayerPanelsMock.mockReturnValue({ kind: 'moves', panels: [] });
    createTeamMock.mockRejectedValueOnce(new Error('quota'));
    render(<OverlayApp />);
    await act(async () => { (globalThis as any).__tap(); });
    await screen.findByTestId('player-scan');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'save-stub' })); });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('player-scan')).toBeTruthy(); // still open for retry
    // retry succeeds
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'save-stub' })); });
    expect(await screen.findByText('Team saved')).toBeTruthy();
    errSpy.mockRestore();
  });
});
