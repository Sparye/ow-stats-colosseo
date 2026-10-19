export type StatKind = 'sample' | 'fair' | 'volume' | 'best'

const SAMPLE_SIZE_KEYS = new Set(['time_played', 'games_played'])

/**
 * Manual fixes for keys the naming rules below get wrong. Add an entry when a
 * hero's stat lands in the wrong section.
 */
const OVERRIDES: Record<string, StatKind> = {}

export function statKind(key: string): StatKind {
  if (key in OVERRIDES) return OVERRIDES[key]
  if (SAMPLE_SIZE_KEYS.has(key)) return 'sample'
  if (key.includes('_most_in_') || key.includes('_best')) return 'best'
  if (
    key === 'win_percentage' ||
    key.endsWith('_avg_per_10_min') ||
    key.endsWith('_per_life') ||
    key.endsWith('accuracy')
  ) {
    return 'fair'
  }
  return 'volume'
}

export function isLowerBetter(key: string): boolean {
  return key.includes('deaths')
}
