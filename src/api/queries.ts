import { QueryClient, queryOptions } from '@tanstack/react-query'
import type { Gamemode, Platform } from '../domain/matchupSearch'
import { OverfastError, getHeroes, getPlayerStats, getPlayerSummary, isPublicProfile } from './overfast'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // OverFast caches player data for 10 minutes; no point asking sooner.
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Don't retry what won't change: unknown players or bad requests.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof OverfastError && error.status >= 400 && error.status < 500 && error.status !== 429),
      },
    },
  })
}

export const heroesQuery = () =>
  queryOptions({ queryKey: ['heroes'], queryFn: getHeroes, staleTime: 24 * 60 * 60 * 1000 })

export const playerSummaryQuery = (playerId: string) =>
  queryOptions({ queryKey: ['player', playerId, 'summary'], queryFn: () => getPlayerSummary(playerId) })

export const playerStatsQuery = (playerId: string, gamemode: Gamemode, platform: Platform) =>
  queryOptions({
    queryKey: ['player', playerId, 'stats', gamemode, platform],
    queryFn: () => getPlayerStats(playerId, gamemode, platform),
  })

export const playerPrivacyQuery = (playerId: string) =>
  queryOptions({ queryKey: ['player', playerId, 'public'], queryFn: () => isPublicProfile(playerId) })
