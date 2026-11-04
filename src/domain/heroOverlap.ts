import { findLeaders, type Score } from './comparison'

/** A Player's win rate only counts once they have this many games on the hero; below it, a win or two swings it wildly. */
export const MIN_GAMES = 3

/** One hero's totals for one Player, as OverFast's `/players/{id}/stats/summary` returns them. */
export type HeroSummary = {
  games_played: number
  time_played: number
  winrate: number
  kda: number
}

/** Keyed by hero key. */
export type HeroSummaries = Record<string, HeroSummary>

/** One hero in a Player's Hero Pool. */
export type PoolHero = {
  key: string
  timePlayed: number
  /** Time played as a share of the Player's most played hero, from 0 to 1. */
  share: number
  /** Whether it's a Shared Hero. */
  shared: boolean
}

export type HeroResult = {
  winrate: number
  kda: number
  games: number
  /** Whether there are enough games for this win rate to be compared. */
  comparable: boolean
}

export type SharedHero = {
  key: string
  /** One per Slot; `null` where that Player hasn't played the hero. */
  results: Array<HeroResult | null>
  /** Slot indices of the Players with the best win rate. */
  leaders: number[]
}

export type HeroOverlap = {
  /** One per Slot, most played first; `null` for a Slot with nothing to show (empty, loading, private or failed). */
  pools: Array<PoolHero[] | null>
  /** Heroes that can have a Leader first, then by time played across every Player. */
  shared: SharedHero[]
  /** How many Shared Heroes each Slot leads, out of those with a Leader; `null` for a Slot with an empty Hero Pool. */
  tally: Array<Score | null>
}

/** Lines up every Player's heroes. Pass `null` for a Slot with nothing to show. */
export function buildHeroOverlap(slots: Array<HeroSummaries | null>): HeroOverlap {
  const played = slots.map((heroes) =>
    heroes ? Object.entries(heroes).filter(([, hero]) => hero.games_played > 0) : null,
  )

  const players = new Map<string, number>()
  for (const heroes of played) for (const [key] of heroes ?? []) players.set(key, (players.get(key) ?? 0) + 1)
  const isShared = (key: string) => (players.get(key) ?? 0) >= 2

  const pools = played.map((heroes) => {
    if (!heroes) return null
    const longest = Math.max(...heroes.map(([, hero]) => hero.time_played))
    return heroes
      .map(([key, hero]) => ({
        key,
        timePlayed: hero.time_played,
        share: hero.time_played / longest,
        shared: isShared(key),
      }))
      .sort((a, b) => b.timePlayed - a.timePlayed)
  })

  const shared = [...players.keys()].filter(isShared).map((key) => buildSharedHero(key, slots))
  const totalTime = (hero: SharedHero) =>
    slots.reduce((sum, heroes) => sum + (heroes?.[hero.key]?.time_played ?? 0), 0)
  const canLead = (hero: SharedHero) => hero.results.filter((r) => r?.comparable).length >= 2
  shared.sort((a, b) => Number(canLead(b)) - Number(canLead(a)) || totalTime(b) - totalTime(a))

  const contested = shared.filter((hero) => hero.leaders.length > 0)
  const tally = pools.map((pool, slot) =>
    pool?.length ? { leads: contested.filter((hero) => hero.leaders.includes(slot)).length, of: contested.length } : null,
  )

  return { pools, shared, tally }
}

function buildSharedHero(key: string, slots: Array<HeroSummaries | null>): SharedHero {
  const results = slots.map((heroes): HeroResult | null => {
    const hero = heroes?.[key]
    if (!hero || hero.games_played === 0) return null
    return { winrate: hero.winrate, kda: hero.kda, games: hero.games_played, comparable: hero.games_played >= MIN_GAMES }
  })
  const leaders = findLeaders(
    results.map((r) => (r?.comparable ? r.winrate : null)),
    false,
  )
  return { key, results, leaders }
}
