import type { PlayerFrameScan, TextFieldRead } from './scanPlayerFrame';
import { LANGS } from './scanPlayerFrame';
import type { StatRowRead } from './statDigits';
import type { ScanLang } from './playerTypes';
import type { Candidate } from './types';
import { championsHP, championsStat } from '@/features/pokemon/utils/champions-stats';
import { getNatureFromStats, getFormattedNature } from '@/features/pokemon/utils/pokemon-natures';
import type { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import type { MoveData } from '@/components/molecules/MoveSearchSelect';
import type { PlayerScanVocab } from '@/db/repositories/scan.repo';
import type { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';

const MULTS = [0.9, 1, 1.1] as const;
const CONFIDENT_SCORE = 0.72;   // CALIBRATE against goldens
const CONFIDENT_MARGIN = 0.03;  // CALIBRATE

// Row index -> nature stat key, canonical [hp,atk,def,spa,spd,spe] with HP excluded.
const NATURE_STAT_KEYS = ['atk', 'def', 'spa', 'spd', 'spe'] as const;

export interface FieldRead<T> { value: T | null; options: Array<{ value: T; score: number }>; confident: boolean }
export interface SlotStatRead { stat: number | null; sp: number | null; mult: 0.9 | 1 | 1.1 | null; consistent: boolean }
export interface PlayerSlot {
  slot: number;
  species: Candidate[];             // ranked; [0] is current pick
  ability: FieldRead<string>;       // English ability name
  item: FieldRead<string>;          // English item name
  moves: Array<FieldRead<number>>;  // move ids, length 4
  statReads: SlotStatRead[];        // length 6 [hp,atk,def,spa,spd,spe]; empty array if stats image missing
  nature: { name: string; confident: boolean };  // display-form name via getFormattedNature
  warnings: string[];
}
export interface MergedPlayerScan { lang: ScanLang | null; slots: PlayerSlot[]; warnings: string[] }

export function solveStatRow(base: number, read: StatRowRead): SlotStatRead {
  const { stat, sp, arrow } = read;
  const arrowMult = arrow === 'up' ? 1.1 : arrow === 'down' ? 0.9 : 1;
  if (stat != null && sp != null) {
    const mathMult = MULTS.find(m => championsStat(base, sp, m) === stat) ?? null;
    if (mathMult != null) {
      return { stat, sp, mult: mathMult, consistent: mathMult === arrowMult };
    }
    // digits fit no multiplier: trust arrow + sp, repair stat
    return { stat: championsStat(base, sp, arrowMult), sp, mult: arrowMult, consistent: false };
  }
  if (sp != null) return { stat: championsStat(base, sp, arrowMult), sp, mult: arrowMult, consistent: false };
  if (stat != null) {
    // recover sp from stat + arrow
    for (let s = 0; s <= 32; s++) if (championsStat(base, s, arrowMult) === stat)
      return { stat, sp: s, mult: arrowMult, consistent: false };
  }
  return { stat, sp, mult: null, consistent: false };
}

function solveHpRow(base: number, read: StatRowRead): SlotStatRead {
  const { stat, sp } = read;
  if (stat != null && sp != null) {
    return { stat, sp, mult: null, consistent: stat === championsHP(base, sp) };
  }
  if (sp != null) return { stat: championsHP(base, sp), sp, mult: null, consistent: false };
  if (stat != null) {
    const repairedSp = Math.max(0, Math.min(32, stat - base - 75));
    return { stat, sp: repairedSp, mult: null, consistent: false };
  }
  return { stat: null, sp: null, mult: null, consistent: false };
}

export function pickLang(fields: TextFieldRead[]): ScanLang | null {
  let best: ScanLang | null = null;
  let bestMean = -Infinity;
  for (const lang of LANGS) {
    let sum = 0;
    let count = 0;
    for (const field of fields) {
      const top = field.byLang[lang][0];
      if (top) { sum += top.score; count++; }
    }
    if (count === 0) continue;
    const mean = sum / count;
    if (mean > bestMean) { bestMean = mean; best = lang; }
  }
  return best;
}

function resolveField<T>(field: TextFieldRead | null, lang: ScanLang | null, parse: (key: string) => T): FieldRead<T> {
  const list = lang != null ? field?.byLang[lang] ?? [] : [];
  const top = list[0];
  const second = list[1];
  return {
    value: top ? parse(top.key) : null,
    options: list.slice(0, 3).map(m => ({ value: parse(m.key), score: m.score })),
    confident: !!top && top.score >= CONFIDENT_SCORE && (list.length < 2 || top.score - second.score >= CONFIDENT_MARGIN),
  };
}

const emptyField = <T>(): FieldRead<T> => ({ value: null, options: [], confident: false });

function deriveNature(rows: SlotStatRead[]): { name: string; confident: boolean; warning?: string } {
  // rows[0] is HP; non-HP rows are rows[1..5] mapped to NATURE_STAT_KEYS
  const nonHp = rows.slice(1, 6);
  const boosted = nonHp.filter(r => r.mult === 1.1);
  const hindered = nonHp.filter(r => r.mult === 0.9);
  const allNeutral = nonHp.every(r => r.mult === 1);
  if (allNeutral) {
    return { name: 'Serious', confident: nonHp.every(r => r.consistent) };
  }
  if (boosted.length === 1 && hindered.length === 1) {
    const boostKey = NATURE_STAT_KEYS[nonHp.indexOf(boosted[0])];
    const hinderKey = NATURE_STAT_KEYS[nonHp.indexOf(hindered[0])];
    return {
      name: getFormattedNature(getNatureFromStats(boostKey, hinderKey)),
      confident: nonHp.every(r => r.consistent),
    };
  }
  return { name: 'Serious', confident: false, warning: 'ambiguous nature read' };
}

export function mergePlayerScan(
  movesScan: Extract<PlayerFrameScan, { kind: 'moves' }> | null,
  statsScan: Extract<PlayerFrameScan, { kind: 'stats' }> | null,
  basesById: Map<number, PokemonBaseStats>,
): MergedPlayerScan {
  const movesPanels = movesScan?.panels ?? [];
  const statsPanels = statsScan?.panels ?? [];
  const slotCount = Math.max(movesPanels.length, statsPanels.length);
  const warnings: string[] = [];

  const allTextFields: TextFieldRead[] = [];
  for (const p of movesPanels) {
    if (p.ability) allTextFields.push(p.ability);
    if (p.item) allTextFields.push(p.item);
    for (const m of p.moves) if (m) allTextFields.push(m);
  }
  const lang = pickLang(allTextFields);

  const slots: PlayerSlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    const movesPanel = movesPanels[i];
    const statsPanel = statsPanels[i];
    const slotWarnings: string[] = [];

    // Species merge: moves-image wins on disagreement between both images.
    let species: Candidate[];
    if (movesPanel && statsPanel) {
      species = movesPanel.species;
      const movesTop = movesPanel.species[0]?.id;
      const statsTop = statsPanel.species[0]?.id;
      if (movesTop != null && statsTop != null && movesTop !== statsTop) {
        slotWarnings.push('species disagreement between moves and stats screens');
      }
    } else {
      species = movesPanel?.species ?? statsPanel?.species ?? [];
    }

    const base = basesById.get(species[0]?.id ?? -1);

    let statReads: SlotStatRead[];
    if (statsPanel && base) {
      statReads = statsPanel.rows.map((row, idx) => idx === 0 ? solveHpRow(base.baseHp, row) : solveStatRow(
        [base.baseAttack, base.baseDefense, base.baseSpAtk, base.baseSpDef, base.baseSpeed][idx - 1], row,
      ));
    } else {
      statReads = [];
      if (!statsPanel) slotWarnings.push('stats screen not scanned');
    }

    let ability: FieldRead<string>;
    let item: FieldRead<string>;
    let moves: Array<FieldRead<number>>;
    if (movesPanel) {
      ability = resolveField(movesPanel.ability, lang, key => key);
      item = resolveField(movesPanel.item, lang, key => key);
      moves = movesPanel.moves.map(m => resolveField(m, lang, key => Number(key)));
      while (moves.length < 4) moves.push(emptyField<number>());
    } else {
      ability = emptyField<string>();
      item = emptyField<string>();
      moves = [emptyField<number>(), emptyField<number>(), emptyField<number>(), emptyField<number>()];
      slotWarnings.push('moves screen not scanned');
    }

    const natureResult = statsPanel && base ? deriveNature(statReads) : { name: 'Serious', confident: false };
    if ('warning' in natureResult && natureResult.warning) slotWarnings.push(natureResult.warning);

    slots.push({
      slot: i,
      species,
      ability,
      item,
      moves,
      statReads,
      nature: { name: natureResult.name, confident: natureResult.confident },
      warnings: slotWarnings,
    });
  }

  return { lang, slots, warnings };
}

export function buildConfigs(
  merged: MergedPlayerScan,
  basesById: Map<number, PokemonBaseStats>,
  movesById: Map<number, MoveData>,
  vocab: PlayerScanVocab,
): PokemonConfig[] {
  const configs: PokemonConfig[] = [];
  for (const slot of merged.slots) {
    const id = slot.species[0]?.id;
    if (id == null) continue;
    const base = basesById.get(id);
    if (!base) continue;

    const spByStat = [0, 1, 2, 3, 4, 5].map(i => slot.statReads[i]?.sp ?? 0);
    const moves = slot.moves.map(m => (m.value != null ? movesById.get(m.value) ?? null : null));
    while (moves.length < 4) moves.push(null);

    configs.push({
      selectedId: base.id,
      type1: base.type1,
      type2: base.type2,
      baseHp: base.baseHp,
      baseAtk: base.baseAttack,
      baseDef: base.baseDefense,
      baseSpa: base.baseSpAtk,
      baseSpd: base.baseSpDef,
      baseSpe: base.baseSpeed,
      spHp: spByStat[0],
      spAtk: spByStat[1],
      spDef: spByStat[2],
      spSpa: spByStat[3],
      spSpd: spByStat[4],
      spSpe: spByStat[5],
      nature: slot.nature.name,
      moves: moves.slice(0, 4),
      activeMoveIndex: 0,
      abilities: vocab.abilitiesFor(base.id).map(a => a.key),
      activeAbility: slot.ability.value,
      item: slot.item.value,
      hpPercent: 100,
      isTypeOverridden: false,
    });
  }
  return configs;
}
