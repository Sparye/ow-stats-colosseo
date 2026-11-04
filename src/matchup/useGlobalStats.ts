import { useQueries } from '@tanstack/react-query'
import { globalHeroStatsQuery } from '../api/queries'
import { REGIONS, averageRegions, type GlobalAverage, type RankTier, type Region } from '../domain/benchmark'
import type { Gamemode, Platform } from '../domain/matchupSearch'

export type GlobalStats =
  | { status: 'loading' }
  /** No region answered. */
  | { status: 'failed'; retry: () => void }
  /** `stats` is null if OverFast has nothing on the hero; `missing` lists the regions that didn't answer. */
  | { status: 'ready'; stats: GlobalAverage | null; missing: Region[] }

type Request = {
  heroKey: string | undefined
  gamemode: Gamemode
  platform: Platform
  region: Region | 'all'
}

/**
 * Loads global hero stats for every Rank Tier asked for (`null` is all ranks), one
 * request per region, and returns a way to read one tier's average. Every hero comes
 * in the same response, so switching hero asks for nothing new.
 */
export function useGlobalStats(
  { heroKey, gamemode, platform, region }: Request,
  tiers: Array<RankTier | null>,
): (tier: RankTier | null) => GlobalStats {
  const wanted = heroKey ? [...new Set(tiers)] : []
  const regions = region === 'all' ? REGIONS : [region]
  const results = useQueries({
    queries: wanted.flatMap((tier) => regions.map((r) => globalHeroStatsQuery(platform, gamemode, r, tier))),
  })

  return (tier) => {
    const at = wanted.indexOf(tier)
    if (at < 0 || !heroKey) return { status: 'loading' }
    const answers = results.slice(at * regions.length, (at + 1) * regions.length)
    if (answers.some((answer) => answer.isPending)) return { status: 'loading' }
    if (answers.every((answer) => !answer.data)) {
      return { status: 'failed', retry: () => answers.forEach((answer) => void answer.refetch()) }
    }
    return {
      status: 'ready',
      stats: averageRegions(answers.map((answer) => answer.data), heroKey),
      missing: regions.filter((_, i) => !answers[i].data),
    }
  }
}
