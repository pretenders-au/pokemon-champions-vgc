import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createCanvas } from 'canvas';
import { rgbaToPngBase64 } from '../src/features/scan/imageLoading';
import type { RgbaImage } from '../src/features/scan/types';
import { readPng } from './generate-sprite-descriptors';
import { importCorrections } from './import-scan-corrections';

// One translucent pixel: the app must store what the classifier read (RGB), not what a
// premultiplied canvas would round it to.
const crop: RgbaImage = {
  width: 3, height: 2,
  data: new Uint8ClampedArray([
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 200,
    11, 21, 31, 255, 41, 51, 61, 255, 71, 81, 91, 255,
  ]),
};
const png = rgbaToPngBase64(crop, (w, h) => createCanvas(w, h));
const key = (n: number) => n.toString(16).padStart(16, '0');   // shaped like cropKey's output
const identifiers: Record<number, string> = { 25: 'pikachu', 26: 'raichu', 10034: 'charizard-mega-x', 10256: 'palafin-hero' };

function dirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-corrections-test-'));
  const acceptedDir = path.join(root, 'menu-sprites');
  fs.mkdirSync(acceptedDir);
  return { inboxDir: path.join(root, 'inbox'), acceptedDir, thumbsDir: path.join(root, 'thumbs'), identifierOf: (id: number) => identifiers[id] };
}

describe('importCorrections', () => {
  it('stages an app-exported crop, pixel for pixel, under a name the training scripts read as its id', () => {
    const opts = dirs();
    const { staged, rejected } = importCorrections({ version: 1, samples: [{ key: key(0xab12), id: 25, predicted: 26, png }] }, opts);
    expect(rejected).toEqual([]);
    expect(staged).toEqual(['25_user_Xnip-correction_was26_000000000000ab12.png']);

    // The two rules every consumer of training/menu-sprites applies to a filename.
    expect(staged[0].split('_')[0]).toBe('25');   // class id = text before the first underscore
    expect(staged[0]).toContain('Xnip');          // otherwise it is taken for the id's clean thumbnail

    const back = readPng(path.join(opts.inboxDir, staged[0]));
    expect([back.width, back.height]).toEqual([3, 2]);
    const rgb = (img: RgbaImage) => Array.from(img.data).filter((_, i) => i % 4 !== 3);
    expect(rgb(back)).toEqual(rgb(crop));

    // The sheet shows the crop, the species the user picked and the one the scan showed.
    const sheet = fs.readFileSync(path.join(opts.inboxDir, 'index.html'), 'utf8');
    expect(sheet).toContain(staged[0]);
    expect(sheet).toContain('25 pikachu');
    expect(sheet).toContain('26 raichu');
  });

  it('rejects what must not become training data, and says why', () => {
    const opts = dirs();
    fs.writeFileSync(path.join(opts.acceptedDir, `26_user_Xnip-correction_wasnone_${key(6)}.png`), '');
    const { staged, rejected } = importCorrections({
      version: 1,
      samples: [
        { key: key(1), id: 99999, predicted: null, png },         // not a Pokemon
        { key: key(2), id: 10034, predicted: null, png },         // a Mega never appears in team preview
        { key: key(3), id: 10256, predicted: null, png },         // nor does Palafin's Hero form
        { key: '../../etc/passwd', id: 25, predicted: null, png }, // key becomes part of a path
        { key: key(5), id: 25, predicted: null, png: 'aGVsbG8=' }, // not a PNG
        { key: key(7), id: 25, predicted: null, png: null },      // a hand-edited file
        { key: key(6), id: 25, predicted: null, png },            // this crop is already in training, as Raichu
      ],
    } as never, opts);
    expect(staged).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      'unknown pokemon id', 'battle-only form', 'battle-only form', 'bad key', 'not a PNG', 'not a PNG', 'already in training',
    ]);
  });

  it('keeps one file per crop — a later export with a new label replaces the staged one', () => {
    const opts = dirs();
    importCorrections({ version: 1, samples: [{ key: key(1), id: 25, predicted: 26, png }] }, opts);
    const { staged } = importCorrections({ version: 1, samples: [{ key: key(1), id: 26, predicted: null, png }] }, opts);
    expect(staged).toEqual([`26_user_Xnip-correction_wasnone_${key(1)}.png`]);
    expect(fs.readdirSync(opts.inboxDir).filter((f) => f.endsWith('.png'))).toEqual(staged);
    expect(fs.readFileSync(path.join(opts.inboxDir, 'index.html'), 'utf8')).toContain('nothing');
  });

  it('never lets what the scan showed into a path unless it is a whole number', () => {
    const opts = dirs();
    const { staged } = importCorrections({ version: 1, samples: [{ key: key(1), id: 25, predicted: '../x', png }] } as never, opts);
    expect(staged).toEqual([`25_user_Xnip-correction_wasnone_${key(1)}.png`]);
  });

  it('refuses an export it does not understand', () => {
    expect(() => importCorrections({ version: 2, samples: [] } as never, dirs())).toThrow(/version/);
  });
});
