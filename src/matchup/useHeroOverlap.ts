import { useQueries } from '@tanstack/react-query'
import { playerStatsSummaryQuery } from '../api/queries'
import { buildHeroOverlap, type HeroOverlap } from '../domain/heroOverlap'
import { ALL_HEROES, type MatchupSearch } from '../domain/matchupSearch'

/** Where a Slot's Hero Pool has got to; `empty` for a Slot with no Player. */
export type PoolStatus = 'empty' | 'loading' | 'failed' | 'ready'

export type HeroOverlapState = HeroOverlap & {
  /** One per Slot. */
  statuses: PoolStatus[]
}

/**
 * Loads every Player's hero totals independently and lines them up. Asks only on
 * All Heroes, where the Heroes tab is on offer. Its lead bar shows before it's
 * opened, so the requests can't wait for that. A failure here only hides that
 * Player's Hero Pool; the Stat Rows don't depend on it.
 */
export function useHeroOverlap(
  { players, hero, gamemode, platform }: MatchupSearch,
  slotCount: number,
): HeroOverlapState {
  const summaries = useQueries({
    queries: players.map((id) => ({
      ...playerStatsSummaryQuery(id, gamemode, platform),
      enabled: hero === ALL_HEROES,
    })),
  })

  const slots = Array.from({ length: slotCount }, (_, i) => summaries[i])
  return {
    ...buildHeroOverlap(slots.map((summary) => summary?.data?.heroes ?? null)),
    statuses: slots.map((summary) => {
      if (!summary) return 'empty'
      if (summary.isError) return 'failed'
      return summary.isSuccess ? 'ready' : 'loading'
    }),
  }
}
