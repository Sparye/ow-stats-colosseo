import type { Hero } from '../api/overfast'
import { highestRankTier, rankAdjustedWinRate, rankTierOf, type RankTier } from '../domain/benchmark'
import { WIN_RATE, statValue, type HeroStats } from '../domain/comparison'
import type { MatchupSearch } from '../domain/matchupSearch'
import { formatDifference, rankFor, regionsNote, tierLabel } from './format'
import type { WinRateNote } from './StatTable'
import { useGlobalStats, type GlobalStats } from './useGlobalStats'
import type { SlotState } from './useSlots'

type GlobalComparison = {
  /** What the Benchmark's column shows, when it's on. */
  benchmark: {
    /** `null` is all ranks; `undefined` means still waiting for the Players' ranks. */
    tier: RankTier | null | undefined
    /** The tier it follows until one is picked. */
    defaultTier: RankTier | null | undefined
    stats: GlobalStats
  } | null
  /** What the win rate row's Leader goes by instead of the win rates, with the Rank-adjusted toggle on. */
  winRateLeadBy: Array<number | null> | undefined
  /** What goes under each Slot's win rate. */
  winRateNotes: Array<WinRateNote | null>
}

/** Sets the Players against global hero stats: the Benchmark and each Player's Rank-Adjusted Win Rate. */
export function useGlobalComparison(
  search: MatchupSearch,
  hero: Hero | undefined,
  slots: SlotState[],
  slotStats: Array<HeroStats | null>,
): GlobalComparison {
  const competitive = search.gamemode === 'competitive'

  // Each Player's division for the hero's role, in Competitive with a single hero.
  const divisions = slotStats.map((_, i) => {
    const slot = slots[i]
    return competitive && hero && slot && 'summary' in slot
      ? rankFor(slot.summary, search.platform, hero)?.division
      : null
  })
  const slotTiers = divisions.map(rankTierOf)

  // Waits for every Player, so a slow one doesn't make the Benchmark jump from one tier to another.
  const defaultTier = slots.some((slot) => slot.status === 'loading') ? undefined : highestRankTier(divisions)
  const chosenTier = search.benchmarkTier === 'all' ? null : (search.benchmarkTier ?? defaultTier)
  const benchmarkTier = competitive ? chosenTier : null
  const benchmarkOn = search.benchmark && !!hero

  const globalStats = useGlobalStats(
    { heroKey: hero?.key, gamemode: search.gamemode, platform: search.platform, region: search.region },
    [...slotTiers.filter((tier) => tier !== null), ...(benchmarkOn && benchmarkTier !== undefined ? [benchmarkTier] : [])],
  )

  const adjusted = slotStats.map((stats, slot) => {
    const winRate = statValue(stats, WIN_RATE)
    const tier = slotTiers[slot]
    if (winRate === null || !tier) return null
    const global = globalStats(tier)
    if (global.status !== 'ready' || !global.stats) return null
    const { winrate } = global.stats
    return { tier, winrate, missing: global.missing, difference: rankAdjustedWinRate(winRate, winrate) }
  })
  const rankAdjustedOn = search.rankAdjusted && competitive && !!hero

  return {
    benchmark: benchmarkOn
      ? {
          tier: benchmarkTier,
          defaultTier,
          stats: benchmarkTier === undefined ? { status: 'loading' } : globalStats(benchmarkTier),
        }
      : null,
    winRateLeadBy: rankAdjustedOn ? adjusted.map((a) => a?.difference ?? null) : undefined,
    winRateNotes: adjusted.map((a, slot) => {
      if (a) {
        return {
          text: `${formatDifference(a.difference)} vs ${tierLabel(a.tier)}`,
          hover: `Global ${tierLabel(a.tier)} win rate on ${hero?.name}: ${a.winrate}%. ${regionsNote(search.region, a.missing)}`,
        }
      }
      // Only matters when it's the reason a higher win rate isn't leading.
      const unranked = rankAdjustedOn && !slotTiers[slot] && statValue(slotStats[slot], WIN_RATE) !== null
      return unranked ? { text: 'No rank', hover: `No rank for ${hero?.name}'s role, so left out of this row` } : null
    }),
  }
}
