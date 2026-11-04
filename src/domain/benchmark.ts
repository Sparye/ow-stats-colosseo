/** The regions OverFast splits its global hero stats by. */
export const REGIONS = ['europe', 'americas', 'asia'] as const
/** Lowest to highest. These are the divisions OverFast can filter its global hero stats by. */
export const RANK_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster'] as const

export type Region = (typeof REGIONS)[number]
export type RankTier = (typeof RANK_TIERS)[number]

/** One hero's numbers across everyone playing, in percent, as OverFast's `/heroes/stats` returns them. */
export type GlobalHeroStat = {
  hero: string
  pickrate: number
  winrate: number
  /** Only Competitive has bans. */
  banrate?: number | null
}

export type GlobalAverage = { winrate: number; pickrate: number; banrate: number | null }

/** OverFast reports one decimal, so everything shown or compared here stays at one. */
const oneDecimal = (value: number) => Math.round(value * 10) / 10 + 0 // + 0 turns -0 into 0.

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * One hero's global stats, each region counting the same however many games it
 * had (OverFast doesn't say). `undefined` is a region that didn't answer. Only the
 * regions with the hero are averaged; `null` if none have it.
 */
export function averageRegions(regions: Array<GlobalHeroStat[] | undefined>, hero: string): GlobalAverage | null {
  const found = regions.flatMap((stats) => stats?.find((s) => s.hero === hero) ?? [])
  if (found.length === 0) return null
  const banrates = found.flatMap((s) => s.banrate ?? [])
  return {
    winrate: oneDecimal(mean(found.map((s) => s.winrate))),
    pickrate: oneDecimal(mean(found.map((s) => s.pickrate))),
    banrate: banrates.length > 0 ? oneDecimal(mean(banrates)) : null,
  }
}

/** The Rank Tier of a Player's division. OverFast's Grandmaster filter includes the division above it. */
export function rankTierOf(division: string | null | undefined): RankTier | null {
  if (division === 'ultimate' || division === 'champion') return 'grandmaster'
  return RANK_TIERS.find((tier) => tier === division) ?? null
}

/** The highest Rank Tier among these divisions; `null` if none of them has one. */
export function highestRankTier(divisions: Array<string | null | undefined>): RankTier | null {
  const ranks = divisions.map((division) => RANK_TIERS.indexOf(rankTierOf(division) as RankTier))
  return RANK_TIERS[Math.max(...ranks, -1)] ?? null
}

/** A Player's Rank-Adjusted Win Rate: percentage points above or below the global win rate at their Rank Tier. */
export function rankAdjustedWinRate(winRate: number, globalWinRate: number): number {
  return oneDecimal(winRate - globalWinRate)
}
