/**
 * Scan corrections as training data: when the user confirms a scanned roster after
 * re-picking a slot, that slot's crop plus the species they chose is a labelled sample the
 * sprite classifier got wrong. Samples are saved on this device, exported by hand
 * (ScanCorrectionsExport) and staged for review by scripts/import-scan-corrections.ts.
 */
import type { RgbaImage } from './types';
import type { ScanEntry } from './roster';
import { rgbaToPngBase64 } from './imageLoading';
import { putSamples } from './correctionStore';

export interface Correction { crop: RgbaImage; id: number }

/**
 * The scanned slots the user re-labelled, judged on the roster being confirmed — not per
 * pick, since fixing two swapped slots goes through an intermediate species.
 *
 * Player-side slots are skipped: these screens build the opponent's roster, so one of the
 * player's own cards that ends up in a visible slot gets re-picked to complete that roster,
 * which says nothing about what its crop shows.
 */
export function correctionsFromEntries(entries: ScanEntry[]): Correction[] {
  return entries.flatMap((entry) =>
    entry.scanned && entry.id != null && entry.id !== entry.scanned.id && entry.side !== 'player'
      ? [{ crop: entry.scanned.crop, id: entry.id }]
      : [],
  );
}

/**
 * Content hash of a crop (cyrb53 over its size and bytes), as 16 hex digits. Keying samples
 * by it means correcting the same crop again — for example after scanning the same
 * screenshot again — replaces the earlier sample instead of adding a duplicate. Confirming
 * it as scanned leaves the earlier sample in place.
 */
export function cropKey({ data, width, height }: RgbaImage): string {
  let h1 = 0xdeadbeef ^ width;
  let h2 = 0x41c6ce57 ^ height;
  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 2654435761);
    h2 = Math.imul(h2 ^ data[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h2, h1].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Saves the corrections in a roster the user just confirmed. Call it from a final-confirm
 * handler and do not wait on it: it never rejects, so a storage failure cannot break
 * confirming a scan.
 */
export async function recordCorrections(entries: ScanEntry[]): Promise<void> {
  const found = correctionsFromEntries(entries);
  if (found.length === 0) return;
  try {
    await putSamples(found.map(({ crop, id }) => ({ key: cropKey(crop), id, png: rgbaToPngBase64(crop) })));
  } catch (err) {
    console.warn('[scan] could not save scan corrections', err);
  }
}
