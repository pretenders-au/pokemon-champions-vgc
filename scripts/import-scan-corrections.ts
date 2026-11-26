// scripts/import-scan-corrections.ts
/**
 * Stages scan corrections exported from the app ("Export" on the scan screens) for review
 * before they become training data.
 *
 * CLI: npx tsx scripts/import-scan-corrections.ts <scan-corrections-YYYY-MM-DD.json>
 *
 * Writes each crop to training/corrections-inbox/<id>_user_Xnip-correction_<key>.png plus an
 * index.html that shows every staged crop beside the species it was labelled as. Nothing
 * here touches training/menu-sprites: a correction is only what a user picked, and every
 * file in menu-sprites becomes both a classifier sample and a descriptor reference. Look
 * at the sheet, delete the wrong ones, then move the rest over by hand.
 *
 * The filename matters to the scripts that read training/menu-sprites: the class id is the
 * text before the first underscore, and a name without "Xnip" is taken for that id's clean
 * card thumbnail (generate-sprite-descriptors.ts, generate-panel-crops.ts). The "user" tag
 * sorts the file after the labelled crops, so it does not replace the one those scripts
 * pick first for an id that has no clean thumbnail.
 */
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { CorrectionsExport } from '../src/features/scan/correctionStore';

export interface ImportOptions {
  inboxDir: string;
  /** training/menu-sprites: a crop already there, under any id, was accepted earlier and is not staged again. */
  acceptedDir: string;
  /** Reference art for the contact sheet, <id>.png per species. */
  thumbsDir: string;
  /** The pokemon table's identifier for an id, undefined when there is no such Pokemon. */
  identifierOf: (id: number) => string | undefined;
}

export interface ImportResult {
  staged: string[];
  rejected: Array<{ key: string; id: number; reason: string }>;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const idOf = (file: string) => Number(file.split('_')[0]);

export function importCorrections(data: CorrectionsExport, opts: ImportOptions): ImportResult {
  if (data.version !== 1) throw new Error(`Unsupported export version: ${data.version}`);
  fs.mkdirSync(opts.inboxDir, { recursive: true });

  const result: ImportResult = { staged: [], rejected: [] };
  for (const { key, id, png } of data.samples) {
    const reject = (reason: string) => { result.rejected.push({ key, id, reason }); };
    const identifier = opts.identifierOf(id);
    const bytes = Buffer.from(typeof png === 'string' ? png : '', 'base64');
    // One crop, one file: the key alone identifies it, whatever id it was filed under.
    const sameCrop = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith(`_Xnip-correction_${key}.png`));

    if (!identifier) reject('unknown pokemon id');
    // Team preview shows the base form, so a Mega label on a team-preview crop is a pick
    // made for the calculator, not what the crop shows.
    else if (identifier.includes('-mega') || identifier === 'palafin-hero') reject('battle-only form');
    else if (!/^[0-9a-f]{16}$/.test(key)) reject('bad key');
    else if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) reject('not a PNG');
    else if (sameCrop(opts.acceptedDir).length > 0) reject('already in training');
    else {
      // A newer export may carry a newer label for a crop that is still waiting here.
      for (const stale of sameCrop(opts.inboxDir)) fs.rmSync(path.join(opts.inboxDir, stale));
      const name = `${id}_user_Xnip-correction_${key}.png`;
      fs.writeFileSync(path.join(opts.inboxDir, name), bytes);
      result.staged.push(name);
    }
  }

  // The sheet lists the whole inbox, not just this run, so it always matches the folder.
  const files = fs.readdirSync(opts.inboxDir).filter((f) => f.endsWith('.png')).sort((a, b) => idOf(a) - idOf(b));
  const thumbs = path.relative(opts.inboxDir, opts.thumbsDir);
  const rows = files.map((file) => `<tr>
  <td><img src="${file}" width="96"></td>
  <td><img src="${thumbs}/${idOf(file)}.png" width="96"></td>
  <td>${idOf(file)} ${opts.identifierOf(idOf(file)) ?? ''}<br><small>${file}</small></td>
</tr>`);
  fs.writeFileSync(
    path.join(opts.inboxDir, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Scan corrections to review</title>
<p>Left: the scanned crop. Right: the species it was labelled as. Delete the files where they do not match.</p>
<table cellpadding="6">\n${rows.join('\n')}\n</table>\n`,
  );
  return result;
}

if (process.argv[1]?.endsWith('import-scan-corrections.ts')) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/import-scan-corrections.ts <scan-corrections.json>');
    process.exit(1);
  }
  const db = new Database(path.resolve('vgc_pokemon.db'), { readonly: true });
  const identifiers = new Map(
    (db.prepare('SELECT id, identifier FROM pokemon').all() as Array<{ id: number; identifier: string }>)
      .map((row) => [row.id, row.identifier]),
  );
  db.close();

  const inboxDir = path.resolve('training/corrections-inbox');
  const { staged, rejected } = importCorrections(JSON.parse(fs.readFileSync(file, 'utf8')), {
    inboxDir,
    acceptedDir: path.resolve('training/menu-sprites'),
    thumbsDir: path.resolve('public/images/pokemon/thumbnails'),
    identifierOf: (id) => identifiers.get(id),
  });

  for (const r of rejected) console.log(`  skipped ${r.id} (${r.key}): ${r.reason}`);
  console.log(`Staged ${staged.length} crop(s) in ${inboxDir}, skipped ${rejected.length}.`);
  console.log(`Next:
  1. open ${path.join(inboxDir, 'index.html')} and delete the crops whose label is wrong
  2. mv training/corrections-inbox/*.png training/menu-sprites/
  3. npx tsx scripts/check-menu-sprite-aspects.ts
  4. npx tsx scripts/generate-sprite-descriptors.ts, then retrain (see scripts/train_sprite_net.py)
  5. press Clear next to Export in the app, so these samples are not exported again`);
}
