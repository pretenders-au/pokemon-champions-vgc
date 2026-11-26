export interface RgbaImage { data: Uint8ClampedArray; width: number; height: number }
export interface TileBox {
  x: number; y: number; w: number; h: number;
  /** Opponent sprite boxes only: the box the pre-zone pick rule would have
   *  produced. The team-vs-battle card-column vote was tuned on that rule's
   *  x-scatter, so it keeps voting on this geometry (see isCardColumn). */
  vote?: { x: number; w: number };
}
export interface Descriptor { dhash: string; rgb16: number[]; sil8: number[]; edge8: number[] }
export interface ReferenceEntry { id: number; desc: Descriptor }
export interface Candidate { id: number; score: number }
export type ScanSide = 'player' | 'opponent';
export interface SlotResult {
  box: TileBox; candidates: Candidate[]; side?: ScanSide; hpPercent?: number | null;
  /** Team-preview scans that found all six opponent cards only: the pixels that were
   *  classified, kept so a user's re-pick can be saved as a labelled training sample
   *  (see corrections.ts). */
  crop?: RgbaImage;
}
