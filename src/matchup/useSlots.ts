import { useQueries } from '@tanstack/react-query'
import { isNotFound, type PlayerStats, type PlayerSummary } from '../api/overfast'
import { playerPrivacyQuery, playerStatsQuery, playerSummaryQuery } from '../api/queries'
import type { HeroStats } from '../domain/comparison'
import type { MatchupSearch } from '../domain/matchupSearch'

export type SlotState =
  | { status: 'loading'; playerId: string }
  | { status: 'not-found'; playerId: string; nextCheckAt: Date | null }
  | { status: 'error'; playerId: string; retry: () => void }
  | { status: 'private'; playerId: string; summary: PlayerSummary }
  | { status: 'no-games'; playerId: string; summary: PlayerSummary }
  | { status: 'ready'; playerId: string; summary: PlayerSummary; heroStats: HeroStats }

const hasAnyStats = (stats: PlayerStats | null | undefined) =>
  !!stats && Object.values(stats).some((hero) => hero && hero.length > 0)

/** Loads every Player in the Matchup independently and says what each Slot can show. */
export function useSlots({ players, hero, gamemode, platform }: MatchupSearch): SlotState[] {
  const summaries = useQueries({ queries: players.map((id) => playerSummaryQuery(id)) })
  const stats = useQueries({ queries: players.map((id) => playerStatsQuery(id, gamemode, platform)) })
  // Only ask about privacy when a Player came back with no stats at all.
  const privacy = useQueries({
    queries: players.map((id, i) => ({
      ...playerPrivacyQuery(id),
      enabled: stats[i].isSuccess && !hasAnyStats(stats[i].data),
    })),
  })

  return players.map((playerId, i): SlotState => {
    const summary = summaries[i]
    const stat = stats[i]
    const notFound = [summary.error, stat.error].find(isNotFound)
    if (notFound) return { status: 'not-found', playerId, nextCheckAt: notFound.nextCheckAt }
    if (summary.isError || stat.isError) {
      return {
        status: 'error',
        playerId,
        retry: () => {
          if (summary.isError) void summary.refetch()
          if (stat.isError) void stat.refetch()
        },
      }
    }
    if (!summary.data || !stat.isSuccess) return { status: 'loading', playerId }

    const heroStats = stat.data?.[hero]
    if (heroStats && heroStats.length > 0) {
      return { status: 'ready', playerId, summary: summary.data, heroStats }
    }
    if (hasAnyStats(stat.data)) return { status: 'no-games', playerId, summary: summary.data }

    const isPublic = privacy[i]
    if (isPublic.isPending) return { status: 'loading', playerId }
    // If the privacy check itself fails, "no games" is the safer thing to claim.
    return isPublic.data === false
      ? { status: 'private', playerId, summary: summary.data }
      : { status: 'no-games', playerId, summary: summary.data }
  })
}
