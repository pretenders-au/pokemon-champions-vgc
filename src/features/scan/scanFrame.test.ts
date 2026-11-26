// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { scanFrame, ingestFrame } from './scanFrame';
import type { RgbaImage, ReferenceEntry, ScanSide, SlotResult } from './types';
import type { ScanMode } from './scanTargets';

const fakeImage: RgbaImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
const box = { x: 0, y: 0, w: 1, h: 1 };

function battleDeps() {
  return {
    loadRefs: async (): Promise<ReferenceEntry[]> => [],
    blobToRgbaImage: async (): Promise<RgbaImage> => fakeImage,
    scanTeamImage: (): SlotResult[] => [],
    detectScanTargets: () => ({
      mode: 'battle' as const,
      gameRect: null,
      targets: [
        { box, side: 'opponent' as const, hpPercent: 62 },
        { box, side: 'player' as const, hpPercent: 100 },
      ],
    }),
    cropImage: (): RgbaImage => fakeImage,
    matchTile: () => [{ id: 25, score: 0.9 }],
    loadClassifier: async () => null,
  };
}

describe('scanFrame', () => {
  it('returns mode + one slot per target, carrying side and hpPercent', async () => {
    const { mode, slots } = await scanFrame(fakeImage, new Set([25]), battleDeps());
    expect(mode).toBe('battle');
    expect(slots.map((s) => s.side)).toEqual(['opponent', 'player']);
    expect(slots.map((s) => s.hpPercent)).toEqual([62, 100]);
    expect(slots[0].candidates[0]).toEqual({ id: 25, score: 0.9 });
  });

  it('uses the legacy descriptor path when only the 3-dep shape is injected', async () => {
    const legacy = {
      loadRefs: async (): Promise<ReferenceEntry[]> => [],
      blobToRgbaImage: async (): Promise<RgbaImage> => fakeImage,
      scanTeamImage: (): SlotResult[] => [{ box, candidates: [{ id: 7, score: 0.5 }] }],
    };
    const { mode, slots } = await scanFrame(fakeImage, new Set([7]), legacy);
    expect(mode).toBeNull();
    expect(slots).toEqual([{ box, candidates: [{ id: 7, score: 0.5 }] }]);
  });
});

describe('scan crops', () => {
  const tile: RgbaImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  const depsFor = (mode: ScanMode, opponentCards: number) => ({
    ...battleDeps(),
    detectScanTargets: () => ({
      mode,
      gameRect: null,
      targets: Array.from({ length: opponentCards }, () => ({ box, side: 'opponent' as const, hpPercent: null })),
    }),
    cropImage: (): RgbaImage => tile,
  });
  const crops = async (mode: ScanMode, opponentCards: number) =>
    (await scanFrame(fakeImage, new Set([25]), depsFor(mode, opponentCards))).slots.map((s) => s.crop);

  it('a team preview with all six opponent cards carries the crop that was classified', async () => {
    expect(await crops('team', 6)).toEqual(Array(6).fill(tile));
  });

  it('a partly detected column carries none — its boxes no longer line up with the cards', async () => {
    expect(await crops('team', 5)).toEqual(Array(5).fill(undefined));
  });

  it('a battle scan carries none — nameplate icons are not collected as corrections', async () => {
    expect(await crops('battle', 6)).toEqual(Array(6).fill(undefined));
  });
});

describe('ingestFrame', () => {
  it('decodes the frame blob then scans', async () => {
    const frame = { blob: new Blob(['x']), sourceKind: 'file' as const, capturedAt: 0 };
    const { mode, slots } = await ingestFrame(frame, new Set([25]), battleDeps());
    expect(mode).toBe('battle');
    expect(slots.length).toBe(2);
  });
});

describe('per-side legalIds resolver', () => {
  it('battle: opponent tiles classify under the roster set, player tiles under the full set', async () => {
    const seen: number[][] = [];
    const deps = {
      loadRefs: async (): Promise<ReferenceEntry[]> => [],
      blobToRgbaImage: async (): Promise<RgbaImage> => fakeImage,
      scanTeamImage: (): SlotResult[] => [],
      detectScanTargets: () => ({
        mode: 'battle' as const,
        gameRect: null,
        targets: [
          { box, side: 'opponent' as const, hpPercent: null },
          { box, side: 'player' as const, hpPercent: null },
        ],
      }),
      cropImage: (): RgbaImage => fakeImage,
      matchTile: () => [],
      loadClassifier: async () => ({
        classes: [],
        classify: async (_t: RgbaImage, ids: Set<number>) => {
          seen.push([...ids].sort((a, b) => a - b));
          return [{ id: 6, score: 0.9 }];
        },
      }),
    };
    const resolver = (side: ScanSide | undefined, mode: ScanMode | null) =>
      mode === 'battle' && side !== 'player' ? new Set([6, 10034]) : new Set([1, 2, 3]);
    await scanFrame(fakeImage, resolver, deps);
    expect(seen).toEqual([[6, 10034], [1, 2, 3]]);
  });

  it('a plain Set behaves exactly as before (adapter default)', async () => {
    const seen: number[][] = [];
    const deps = {
      loadRefs: async (): Promise<ReferenceEntry[]> => [],
      blobToRgbaImage: async (): Promise<RgbaImage> => fakeImage,
      scanTeamImage: (): SlotResult[] => [],
      detectScanTargets: () => ({
        mode: 'battle' as const,
        gameRect: null,
        targets: [
          { box, side: 'opponent' as const, hpPercent: null },
          { box, side: 'player' as const, hpPercent: null },
        ],
      }),
      cropImage: (): RgbaImage => fakeImage,
      matchTile: () => [],
      loadClassifier: async () => ({
        classes: [],
        classify: async (_t: RgbaImage, ids: Set<number>) => {
          seen.push([...ids].sort((a, b) => a - b));
          return [{ id: 6, score: 0.9 }];
        },
      }),
    };
    await scanFrame(fakeImage, new Set([7, 8]), deps);
    expect(seen).toEqual([[7, 8], [7, 8]]);
  });
});
