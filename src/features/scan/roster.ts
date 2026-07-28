import type { Candidate, ScanSide, SlotResult } from '@/features/scan/types';

/**
 * The editable roster behind every scan-confirm screen — the overlay's bubble popup, the
 * Scan-opponent page, and the calculator's scan modal. Decoupled from the raw scan so a
 * slot can be re-picked, and shared so the three cannot disagree about what a roster is.
 */
export interface ScanEntry {
  id: number | null;
  candidates: Candidate[];
  /** Which team the slot belongs to. Absent for hand-added rows and team-preview scans. */
  side?: ScanSide;
  hpPercent?: number | null;
}

/**
 * Below this, a read is shown as needing review. One number: the same scan result must not
 * look trustworthy on one screen and doubtful on another.
 */
export const LOW_CONFIDENCE = 0.9;

type CandidateSlot = Pick<SlotResult, 'candidates'>;

/**
 * Slots sharing a side compete for species; slots on opposite sides do not. Rows added by
 * hand carry no side and count as opponent, which is how they are saved.
 */
const sideKey = (side: ScanSide | undefined): ScanSide => (side === 'player' ? 'player' : 'opponent');

export function assignUniqueCandidates(slots: CandidateSlot[]): ScanEntry[] {
  const current = Array<number | null>(slots.length).fill(null);
  let best = [...current];
  let bestCount = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  const used = new Set<number>();

  const visit = (index: number, count: number, score: number): void => {
    if (index === slots.length) {
      if (count > bestCount || (count === bestCount && score > bestScore)) {
        best = [...current];
        bestCount = count;
        bestScore = score;
      }
      return;
    }

    for (const candidate of slots[index].candidates) {
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      current[index] = candidate.id;
      visit(index + 1, count + 1, score + candidate.score);
      used.delete(candidate.id);
    }

    current[index] = null;
    visit(index + 1, count, score);
  };

  visit(0, 0, 0);
  return slots.map((slot, index) => ({ id: best[index], candidates: slot.candidates }));
}

/**
 * Seed an editable roster from raw scan slots.
 *
 * Species Clause means one team cannot field the same species twice, so a duplicate within
 * a side is always a misread and the assignment re-picks it — choosing the combination with
 * the most identified slots, then the highest total confidence, rather than taking each
 * slot's top candidate greedily. Both teams may field the same species, so the sides are
 * solved separately and a mirror match survives.
 */
export function seedRoster(slots: SlotResult[]): ScanEntry[] {
  const bySide = new Map<string, number[]>();
  slots.forEach((slot, index) => {
    const key = sideKey(slot.side);
    const group = bySide.get(key);
    if (group) group.push(index);
    else bySide.set(key, [index]);
  });

  const ids = Array<number | null>(slots.length).fill(null);
  for (const indices of bySide.values()) {
    const assigned = assignUniqueCandidates(indices.map((i) => slots[i]));
    indices.forEach((slotIndex, i) => { ids[slotIndex] = assigned[i].id; });
  }

  return slots.map((slot, index) => ({
    id: ids[index],
    candidates: slot.candidates,
    side: slot.side,
    hpPercent: slot.hpPercent,
  }));
}

/** Ids already taken by other slots on the same side — those are the ones in competition. */
export function unavailableIdsFor(entries: ScanEntry[], currentIndex: number): Set<number> {
  const side = sideKey(entries[currentIndex]?.side);
  return new Set(
    entries
      .filter((entry, index) => index !== currentIndex && sideKey(entry.side) === side)
      .map((entry) => entry.id)
      .filter((id): id is number => id != null),
  );
}

export function availableCandidatesFor(entries: ScanEntry[], currentIndex: number): Candidate[] {
  const unavailable = unavailableIdsFor(entries, currentIndex);
  return (entries[currentIndex]?.candidates ?? []).filter((candidate) => !unavailable.has(candidate.id));
}

export function updateEntryId(entries: ScanEntry[], index: number, id: number | null): ScanEntry[] {
  if (id != null && unavailableIdsFor(entries, index).has(id)) return entries;
  return entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, id } : entry));
}

/**
 * The opponent species ids to persist: unique, non-null, and never the player's own.
 *
 * A team-preview scan reports both sides, and a preview where fewer than six opponent cards
 * were detected leaves player slots in the first six — so the side filter belongs here, not
 * in each caller.
 */
export function opponentIdsFromEntries(entries: ScanEntry[]): number[] {
  return [
    ...new Set(
      entries
        .filter((entry) => entry.side !== 'player')
        .map((entry) => entry.id)
        .filter((id): id is number => id != null),
    ),
  ];
}
