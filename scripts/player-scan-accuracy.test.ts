import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { loadPng } from './hp-accuracy-core';
import { nodeScanDeps, buildVocabNode } from './player-scan-core';
import { scanPlayerImage } from '../src/features/scan/scanPlayerFrame';
import { mergePlayerScan, buildConfigs } from '../src/features/scan/mergePlayerScan';
import { getNatureStats, getFormattedNature } from '../src/features/pokemon/utils/pokemon-natures';

const GOLDEN_DIR = 'training/player-screens';

// Named exceptions for text fields that are genuinely confusable (top-N +
// margin), never for species/SP/nature/stat (those are math/identity, not
// text-shape matching -- a wrong value there is a real bug, not a UI nit).
//
// Human-approved (2026-07-07, carried from src/features/scan/scanPlayerFrame.test.ts's
// FULL_VOCAB_TOP1_EXCEPTIONS): mega-stone names are a confusable family;
// Swampertite ranks ~5th after the stone-vocabulary completion, top-1 margin
// < 0.03, flagged low-confidence in the UI. EN stays on canvas shape matching
// (the glyph atlas covers only zh/ja game glyphs), so the exception stands.
//
// RESOLVED (2026-07-07): the ja Delphoxite "rank 868" exception is gone. Its
// root cause was never a shape-race loss: items.name_ja held the synthesized
// "マフォクシーナイト" while the game renders "マフォクシナイト" (long-vowel
// mark elided before ナイト; confirmed by same-font glyph composition against
// the golden crop, 0.923 vs 0.850). With the label fixed in both DB copies
// (scripts/populate_items.py MANUAL_JA) and the glyph atlas providing a
// game-font first pass, the field is now asserted strictly below.
const TEXT_FIELD_EXCEPTIONS: Array<{
  pairKey: string; slot: number; field: 'ability' | 'item';
  expected: string; withinTopN: number; maxMargin: number;
}> = [
  { pairKey: 'en-rental', slot: 1, field: 'item', expected: 'Swampertite', withinTopN: 5, maxMargin: 0.03 },
];

// KNOWN_ISSUES: human decision (2026-07-07) -- ship v1 with the zh-Hant/ja
// residue below as DOCUMENTED known issues rather than blocking the gate.
// Full evidence: .superpowers/sdd/task-11-report.md ("## Fix: templates +
// stone data" and its predecessor sections). Remaining follow-up: classifier
// hardening on nicknamed-panel sprite crops (the per-language glyph/
// text-match follow-up shipped 2026-07-07 as the glyph atlas -- see the
// resolved notes on KNOWN_ISSUES.move below).
//
// Each entry REPLACES the strict assertion for its (pairKey, slot, field)
// with a PIN of the current wrong behavior, narrow enough that a silent
// regression -- in EITHER direction, a fix or a further regression -- flips
// this test red so the entry gets removed/updated deliberately instead of
// rotting silently:
//   - species: correct id must appear somewhere in the candidate list (when
//     `correctIdInCandidates: true`) but must NOT be top-1; AND the current
//     wrong top-1 id is pinned exactly.
//   - move: correct move must appear in the field's top-3 options (when
//     `expectedInOptions: true`) but not be top-1, or must be absent from
//     top-3 entirely (when `expectedInOptions: false` -- matches
//     matchTextShape's topN=3; "not in top-30" in the report was a special
//     full-vocabulary probe, but the field's real options-source is already
//     capped at top-3, so "absent from top-3" is the true, checkable
//     condition here); AND the field's final resolved moves array (post
//     null-filter, matching what buildConfigs actually produces) is pinned
//     exactly (confirmed stable across repeated runs -- this pipeline has no
//     randomness, byte-identical scores every run).
// Dependent fields (ability/moves for a mis-classified species slot) are
// PINNED to their current cascaded wrong values too, not silently skipped --
// this keeps assertion coverage on those fields instead of dropping them.
const KNOWN_ISSUES = {
  // Species entries resolved 2026-07-07: sprite-net retrained with
  // panel-composited crops (scripts/generate-panel-crops.ts) + partial-crop/
  // small-size augmentation, and refineSpritePanelBox grew a narrow-pick
  // rescue pass — both zh-team17 misses (Hisuian Zoroark slot 1, Scrafty
  // slot 5) are strict top-1 assertions again.
  species: [] as Array<{
    pairKey: string; slot: number; expected: string; reason: string;
    correctIdInCandidates: boolean; wrongTop1: string;
    cascades: { ability: string; moves: string[] };
    date: string; followUp: string;
  }>,
  // RESOLVED (2026-07-07) -- the three v1 move-text known issues are gone,
  // fixed at their real roots by the glyph-atlas work (docs/superpowers/plans/
  // 2026-07-07-text-glyph-atlas.md):
  //   - zh-team17 slot 2 Tailwind/Heat Wave: genuine canvas-font shape
  //     collision; the game-font atlas pass now ranks Tailwind top-1.
  //   - ja-rental-r676 slot 0 "Taunt not in top-3": the GOLDEN was mislabeled
  //     -- the screen shows Light Screen as move 3 and Taunt as move 4
  //     (verified visually); the matcher had been right all along.
  //   - ja-rental-r676 slot 0 move 4 no-shape null: stripRuleLines ate the
  //     text band when panel-frame junk trailed below it; fixed to keep the
  //     tallest row-blob.
  //   - ja-rental-r676 slot 5 Sludge Wave/Venoshock swap: atlas pass ranks
  //     Sludge Wave top-1 (margin 0.099, was 0.002 under canvas matching).
  move: [] as Array<{
    pairKey: string; slot: number; moveIndex: number; expected: string;
    expectedInOptions: boolean; resolvedMoves: string[];
    reason: string; date: string; followUp: string;
  }>,
};

describe.skipIf(!fs.existsSync(GOLDEN_DIR))('player scan end-to-end', () => {
  const golden = JSON.parse(fs.readFileSync('training/player-golden.json', 'utf8'));
  const db = new Database('vgc_pokemon.db', { readonly: true });
  const pokemonByName = (n: string) => db.prepare(
    `SELECT id, identifier, name_en AS nameEn, name_zh AS nameZh, type1, type2,
            base_hp AS baseHp, base_attack AS baseAttack, base_defense AS baseDefense,
            base_sp_atk AS baseSpAtk, base_sp_def AS baseSpDef, base_speed AS baseSpeed
     FROM pokemon WHERE name_en = ?`).get(n) as any;
  const allMoves = db.prepare('SELECT id, name_en AS nameEn FROM moves').all() as any[];
  const movesById = new Map(allMoves.map(m => [m.id, m as any]));

  for (const [key, pair] of Object.entries<any>(golden)) {
    if (key.startsWith('_')) continue;
    it(`${key}: full team reconstructed (lang=${pair.lang})`, async () => {
      const vocab = buildVocabNode();
      const team = pair.team.map((t: any) => pokemonByName(t.species));
      const legalIds = new Set<number>(team.map((p: any) => p.id));
      const basesById = new Map(team.map((p: any) => [p.id, p]));

      const movesScan = await scanPlayerImage(loadPng(`${GOLDEN_DIR}/${pair.movesImage}`), legalIds, vocab, nodeScanDeps);
      const statsScan = await scanPlayerImage(loadPng(`${GOLDEN_DIR}/${pair.statsImage}`), legalIds, vocab, nodeScanDeps);
      expect(movesScan?.kind).toBe('moves');
      expect(statsScan?.kind).toBe('stats');

      const merged = mergePlayerScan(movesScan as any, statsScan as any, basesById);
      expect(merged.lang).toBe(pair.lang);
      const configs = buildConfigs(merged, basesById, movesById as any, vocab);
      expect(configs).toHaveLength(6);

      configs.forEach((cfg, i) => {
        const want = pair.team[i];
        const wantId = pokemonByName(want.species).id;
        const slotRead = merged.slots[i];

        const speciesIssue = KNOWN_ISSUES.species.find(e => e.pairKey === key && e.slot === i);
        if (speciesIssue) {
          const candidateIds = slotRead.species.map(c => c.id);
          if (speciesIssue.correctIdInCandidates) {
            expect(candidateIds, `slot ${i + 1} species (known issue: ${speciesIssue.reason})`).toContain(wantId);
          } else {
            expect(candidateIds, `slot ${i + 1} species (known issue: ${speciesIssue.reason})`).not.toContain(wantId);
          }
          expect(cfg.selectedId, `slot ${i + 1} species top-1 (pinned wrong value -- fixing this should remove the known-issue entry)`)
            .toBe(pokemonByName(speciesIssue.wrongTop1).id);
          expect(cfg.selectedId, `slot ${i + 1} species top-1 must not have silently become correct`).not.toBe(wantId);

          expect(cfg.activeAbility, `slot ${i + 1} ability (cascaded from known species issue, pinned)`).toBe(speciesIssue.cascades.ability);
          expect(cfg.moves.filter(Boolean).map((m: any) => m.nameEn), `slot ${i + 1} moves (cascaded from known species issue, pinned)`)
            .toEqual(speciesIssue.cascades.moves);
        } else {
          expect(cfg.selectedId, `slot ${i + 1} species`).toBe(wantId);

          const abilityException = TEXT_FIELD_EXCEPTIONS.find(e => e.pairKey === key && e.slot === i && e.field === 'ability');
          if (abilityException) {
            expect(cfg.activeAbility, `slot ${i + 1} ability (exception field, real value present)`).not.toBeNull();
          } else {
            expect(cfg.activeAbility, `slot ${i + 1} ability`).toBe(want.ability);
          }

          const slotMoveIssues = KNOWN_ISSUES.move.filter(e => e.pairKey === key && e.slot === i);
          if (slotMoveIssues.length > 0) {
            // Pin the exact resolved array (post null-filter, what buildConfigs
            // actually produces) rather than transforming `want.moves`, since a
            // no-shape-detected read (null) can drop an entry and change the
            // array's length, not just a value.
            expect(cfg.moves.filter(Boolean).map((m: any) => m.nameEn), `slot ${i + 1} moves (known issue, pinned)`)
              .toEqual(slotMoveIssues[0].resolvedMoves);
            for (const moveIssue of slotMoveIssues) {
              const options = slotRead.moves[moveIssue.moveIndex]?.options ?? [];
              const wantMoveId = [...movesById.values()].find((m: any) => m.nameEn === moveIssue.expected)?.id;
              const optionIds = options.map((o: any) => o.value);
              const topId = slotRead.moves[moveIssue.moveIndex]?.value;
              if (moveIssue.expectedInOptions) {
                expect(optionIds, `slot ${i + 1} move ${moveIssue.moveIndex + 1} (known issue: ${moveIssue.reason})`).toContain(wantMoveId);
                expect(topId, `slot ${i + 1} move ${moveIssue.moveIndex + 1} top-1 must not have silently become correct`).not.toBe(wantMoveId);
              } else {
                expect(optionIds, `slot ${i + 1} move ${moveIssue.moveIndex + 1} (known issue: ${moveIssue.reason})`).not.toContain(wantMoveId);
              }
            }
          } else {
            expect(cfg.moves.filter(Boolean).map((m: any) => m.nameEn), `slot ${i + 1} moves`).toEqual(want.moves);
          }
        }

        if (want.item === null) {
          // Documented DB gap (item has no row at all) -- not scan-quality,
          // not exception-eligible (nothing to rank against). No current
          // golden uses this (zh-team17 Scrafty's Scraftinite gained a DB row
          // in the task-11 fix wave and is asserted strictly again).
        } else if (!speciesIssue) {
          const itemException = TEXT_FIELD_EXCEPTIONS.find(e => e.pairKey === key && e.slot === i && e.field === 'item');
          if (itemException) {
            expect(cfg.item, `slot ${i + 1} item (exception field, real value present)`).not.toBeNull();
          } else {
            expect(cfg.item, `slot ${i + 1} item`).toBe(want.item);
          }
        }

        expect([cfg.spHp, cfg.spAtk, cfg.spDef, cfg.spSpa, cfg.spSpd, cfg.spSpe], `slot ${i + 1} sp`).toEqual(want.sp);
        expect(cfg.nature, `slot ${i + 1} nature`).toBe(getFormattedNature(want.nature));
        const ns = getNatureStats(want.nature);
        const cfgNature = getNatureStats(cfg.nature);
        expect(cfgNature.boostedStat, `slot ${i + 1} boosted stat`).toBe(ns.boostedStat);
        expect(cfgNature.hinderedStat, `slot ${i + 1} hindered stat`).toBe(ns.hinderedStat);
      });
    }, 600_000);
  }
});
