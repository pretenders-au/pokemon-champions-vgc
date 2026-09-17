export const STORAGE_KEY = 'champions.format'

/** Latest known regulation; the safe default when nothing else is resolvable. */
export const DEFAULT_FORMAT = 'Regulation M-C'

/**
 * Resolve the initial regulation format from a persisted choice and the list
 * of currently available formats.
 *
 * - Use the stored value when it is still available.
 * - Otherwise use the latest available format (regulation names sort lexically,
 *   so `Regulation M-C` > `Regulation M-B`).
 * - With no available formats, fall back to the stored value or the default.
 */
export function resolveInitialFormat(
  stored: string | null,
  available: string[]
): string {
  if (available.length === 0) {
    return stored ?? DEFAULT_FORMAT
  }
  if (stored && available.includes(stored)) {
    return stored
  }
  return [...available].sort().at(-1)!
}
