import { describe, it, expect } from 'vitest';
import {
  assignUniqueCandidates,
  seedRoster,
  availableCandidatesFor,
  opponentIdsFromEntries,
  unavailableIdsFor,
  updateEntryId,
  type ScanEntry,
} from './roster';
import type { Candidate } from '@/features/scan/types';

const candidates = (...pairs: Array<[number, number]>): Candidate[] =>
  pairs.map(([id, score]) => ({ id, score }));
const entry = (id: number | null, options: Candidate[] = []): ScanEntry => ({ id, candidates: options });

describe('assignUniqueCandidates', () => {
  it('chooses the best overall unique assignment instead of greedy slot order', () => {
    const assigned = assignUniqueCandidates([
      { candidates: candidates([6, 0.9], [25, 0.89]) },
      { candidates: candidates([6, 0.88], [150, 0.1]) },
    ]);
    expect(assigned.map((slot) => slot.id)).toEqual([25, 6]);
  });

  it('leaves a slot empty when every candidate is already used', () => {
    const assigned = assignUniqueCandidates([
      { candidates: candidates([6, 0.9]) },
      { candidates: candidates([6, 0.8]) },
    ]);
    expect(assigned.map((slot) => slot.id)).toEqual([6, null]);
  });
});

describe('manual uniqueness', () => {
  const entries = [
    entry(6, candidates([6, 0.9], [25, 0.2])),
    entry(94, candidates([6, 0.8], [94, 0.7])),
  ];

  it('reserves IDs owned by other slots but keeps the current ID available', () => {
    expect([...unavailableIdsFor(entries, 0)]).toEqual([94]);
    expect(availableCandidatesFor(entries, 1).map((candidate) => candidate.id)).toEqual([94]);
  });

  it('rejects a duplicate manual selection without clearing its owner', () => {
    expect(updateEntryId(entries, 1, 6)).toBe(entries);
    expect(updateEntryId(entries, 0, null).map((slot) => slot.id)).toEqual([null, 94]);
  });
});

describe('opponentIdsFromEntries', () => {
  it('never returns the player\'s own side', () => {
    // A team preview reports both sides, and one detecting fewer than six opponent cards
    // leaves player slots in the first six.
    const entries: ScanEntry[] = [
      { id: 1, candidates: [], side: 'opponent' },
      { id: 2, candidates: [], side: 'player' },
      { id: 3, candidates: [] },
    ];
    expect(opponentIdsFromEntries(entries)).toEqual([1, 3]);
  });

  it('keeps unique non-null ids and drops empty slots', () => {
    expect(opponentIdsFromEntries([entry(445), entry(null), entry(445), entry(823)])).toEqual([445, 823]);
  });

  it('returns an empty array when nothing is identified', () => {
    expect(opponentIdsFromEntries([entry(null), entry(null)])).toEqual([]);
  });
});

describe('seedRoster', () => {
  const slot = (side: 'player' | 'opponent' | undefined, ...pairs: Array<[number, number]>) =>
    ({ side, candidates: candidates(...pairs) }) as never;

  it('re-picks a duplicate within one side — Species Clause makes it a misread', () => {
    // Both opponent slots read Incineroar (1) top, but only one team can field it.
    const entries = seedRoster([
      slot('opponent', [1, 0.9], [2, 0.5]),
      slot('opponent', [1, 0.8], [3, 0.4]),
    ]);
    expect(entries.map((e) => e.id)).toEqual([1, 3]);
  });

  it('keeps the same species on both sides — a mirror match is legal', () => {
    const entries = seedRoster([
      slot('opponent', [1, 0.9]),
      slot('player', [1, 0.9]),
    ]);
    expect(entries.map((e) => e.id)).toEqual([1, 1]);
  });

  it('counts a slot with no side as opponent, so hand-added rows compete with scanned ones', () => {
    const entries = seedRoster([
      slot('opponent', [1, 0.9], [2, 0.5]),
      slot(undefined, [1, 0.8], [3, 0.4]),
    ]);
    expect(entries.map((e) => e.id)).toEqual([1, 3]);
  });

  it('returns entries in slot order, carrying side and hp through', () => {
    const entries = seedRoster([
      { side: 'player', hpPercent: 50, candidates: candidates([1, 0.9]) },
      { side: 'opponent', hpPercent: null, candidates: candidates([2, 0.9]) },
    ] as never);
    expect(entries).toEqual([
      { id: 1, side: 'player', hpPercent: 50, candidates: candidates([1, 0.9]) },
      { id: 2, side: 'opponent', hpPercent: null, candidates: candidates([2, 0.9]) },
    ]);
  });

  it('leaves a slot empty when its side has nothing left', () => {
    const entries = seedRoster([slot('opponent', [1, 0.9]), slot('opponent', [1, 0.8])]);
    expect(entries.map((e) => e.id)).toEqual([1, null]);
  });
});

describe('manual uniqueness is per side', () => {
  const e = (id: number | null, side: 'player' | 'opponent', options: Candidate[] = []): ScanEntry =>
    ({ id, side, candidates: options });

  it('does not block a species already picked on the other side', () => {
    const entries = [e(1, 'opponent'), e(null, 'player', candidates([1, 0.9]))];
    expect(availableCandidatesFor(entries, 1).map((c) => c.id)).toEqual([1]);
    expect(updateEntryId(entries, 1, 1)[1].id).toBe(1);
  });

  it('still blocks a species already picked on the same side', () => {
    const entries = [e(1, 'opponent'), e(null, 'opponent', candidates([1, 0.9]))];
    expect(availableCandidatesFor(entries, 1)).toEqual([]);
    expect(updateEntryId(entries, 1, 1)[1].id).toBeNull();
  });
});
