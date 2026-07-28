/**
 * The Champions SP budget: 32 per stat, 66 across all six. See `CONTEXT.md` > SP and
 * `openspec/specs/ev-sp-conversion-logic`.
 *
 * The per-stat cap is enforced centrally, in both build reducers' `SET_SP`. The total is
 * not, and that asymmetry is deliberate: `openspec/specs/sp-limit-constraint` requires the
 * limit when editing a Pokémon in a team and requires it NOT to apply in the calculator, so
 * it cannot live in the reducers the two surfaces share. Every surface that does enforce it
 * goes through `capSpToBudget`, so they cannot drift apart.
 */
export const SP_TOTAL = 66;

/** The most this stat may take before the six exceed `SP_TOTAL`. */
export const capSpToBudget = (val: number, totalSp: number, currentSp: number): number =>
  Math.min(val, Math.max(0, SP_TOTAL - (totalSp - currentSp)));

/** Whether a spread is over budget — for the read-only displays. */
export const isOverSpBudget = (totalSp: number): boolean => totalSp > SP_TOTAL;

export const convertSpToEv = (sp: number): number => {
  if (sp <= 0) return 0;
  // Maximum SP is 32, which corresponds to 252 EVs
  if (sp >= 32) return 252;
  return 4 + (sp - 1) * 8;
};

export const convertEvToSp = (ev: number): number => {
  if (ev <= 0) return 0;
  return Math.floor((ev + 4) / 8);
};
