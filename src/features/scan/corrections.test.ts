import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScanEntry } from './roster';
import type { RgbaImage } from './types';

vi.mock('./correctionStore', () => ({ putSamples: vi.fn(async () => {}) }));
vi.mock('./imageLoading', () => ({ rgbaToPngBase64: vi.fn(() => 'PNG') }));

import { correctionsFromEntries, cropKey, recordCorrections } from './corrections';
import { putSamples } from './correctionStore';
import { rgbaToPngBase64 } from './imageLoading';

const img = (width: number, height: number, ...bytes: number[]): RgbaImage =>
  ({ data: new Uint8ClampedArray(bytes), width, height });
const crop = img(1, 1, 1, 2, 3, 255);
const scanned = (id: number | null, seeded: number | null, extra: Partial<ScanEntry> = {}): ScanEntry =>
  ({ id, candidates: [], scanned: { crop, id: seeded }, ...extra });

describe('correctionsFromEntries', () => {
  it('keeps only the scanned slots the user re-labelled', () => {
    const found = correctionsFromEntries([
      scanned(2, 1),                 // re-picked
      scanned(1, 1),                 // left as scanned
      scanned(5, null),              // an empty read the user filled in
      scanned(null, 1),              // cleared
      { id: 9, candidates: [] },     // added by hand: no crop behind it
    ]);
    expect(found).toEqual([{ crop, id: 2, predicted: 1 }, { crop, id: 5, predicted: null }]);
  });

  it('ignores the player side — a leaked own card re-picked to finish the opponent roster is not a label', () => {
    expect(correctionsFromEntries([scanned(2, 1, { side: 'player' })])).toEqual([]);
  });
});

describe('cropKey', () => {
  it('is stable for the same pixels and differs for other pixels or another shape', () => {
    const key = cropKey(img(2, 1, 1, 2, 3, 255, 4, 5, 6, 255));
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(cropKey(img(2, 1, 1, 2, 3, 255, 4, 5, 6, 255))).toBe(key);
    expect(cropKey(img(2, 1, 1, 2, 3, 255, 4, 5, 7, 255))).not.toBe(key);
    expect(cropKey(img(1, 2, 1, 2, 3, 255, 4, 5, 6, 255))).not.toBe(key);
  });
});

describe('recordCorrections', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stores each re-labelled crop as a PNG under its content key, with what the scan showed', async () => {
    await recordCorrections([scanned(2, 1), scanned(1, 1)]);
    expect(putSamples).toHaveBeenCalledWith([{ key: cropKey(crop), id: 2, predicted: 1, png: 'PNG' }]);
  });

  it('does nothing when no slot was re-labelled', async () => {
    await recordCorrections([scanned(1, 1)]);
    expect(rgbaToPngBase64).not.toHaveBeenCalled();
    expect(putSamples).not.toHaveBeenCalled();
  });

  it('never rejects — saving a sample must not break confirming a scan', async () => {
    vi.mocked(putSamples).mockRejectedValueOnce(new Error('quota'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(recordCorrections([scanned(2, 1)])).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
