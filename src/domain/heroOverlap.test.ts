import { describe, expect, it } from 'vitest'
import { buildHeroOverlap, type HeroSummaries, type HeroSummary } from './heroOverlap'

const played = (games: number, winrate: number, timePlayed = 600 * games, kda = 2): HeroSummary => ({
  games_played: games,
  winrate,
  time_played: timePlayed,
  kda,
})

const sharedKeys = (slots: Array<HeroSummaries | null>) => buildHeroOverlap(slots).shared.map((h) => h.key)

describe('Hero Pools', () => {
  it('puts each Player’s heroes in order of time played', () => {
    const { pools } = buildHeroOverlap([
      { ana: played(5, 60, 1000), mercy: played(9, 60, 4000), lucio: played(2, 60, 2000) },
      null,
    ])

    expect(pools[0]?.map((h) => h.key)).toEqual(['mercy', 'lucio', 'ana'])
    expect(pools[1]).toBeNull()
  })

  it('leaves out heroes with no games, however long they were swapped to', () => {
    const { pools } = buildHeroOverlap([{ ana: played(1, 100, 300), reaper: played(0, 0, 346) }, null])

    expect(pools[0]?.map((h) => h.key)).toEqual(['ana'])
  })

  it('gives each hero its share of the Player’s most played hero', () => {
    const { pools } = buildHeroOverlap([{ ana: played(5, 60, 1000), mercy: played(9, 60, 4000) }, null])

    expect(pools[0]?.map((h) => h.share)).toEqual([1, 0.25])
  })

  it('marks heroes at least two Players have played as shared', () => {
    const { pools } = buildHeroOverlap([
      { ana: played(5, 60), mercy: played(5, 60) },
      { ana: played(1, 60), reaper: played(5, 60) },
      { reaper: played(0, 0), genji: played(5, 60) },
    ])

    const sharedIn = (slot: number) => pools[slot]?.filter((h) => h.shared).map((h) => h.key)
    expect(sharedIn(0)).toEqual(['ana'])
    expect(sharedIn(1)).toEqual(['ana'])
    // Slot 3's Reaper has no games, so nobody shares Reaper or Genji.
    expect(sharedIn(2)).toEqual([])
  })
})

describe('Shared Heroes', () => {
  it('lists only heroes at least two Players have played', () => {
    expect(
      sharedKeys([
        { ana: played(5, 60), mercy: played(5, 60) },
        { ana: played(5, 40), lucio: played(5, 60) },
        { lucio: played(5, 60), genji: played(5, 60) },
      ]),
    ).toEqual(['ana', 'lucio'])
  })

  it('has none when fewer than two Players have a Hero Pool', () => {
    expect(sharedKeys([{ ana: played(5, 60) }, null])).toEqual([])
    expect(sharedKeys([null, null])).toEqual([])
  })

  it('gives each Slot its numbers, or null where that Player has not played the hero', () => {
    const { shared } = buildHeroOverlap([{ ana: played(5, 60, 3000, 3.5) }, null, { ana: played(4, 50, 2000, 1.25) }])

    expect(shared[0].results).toEqual([
      { winrate: 60, kda: 3.5, games: 5, comparable: true },
      null,
      { winrate: 50, kda: 1.25, games: 4, comparable: true },
    ])
  })

  it('makes the Player with the best win rate the Leader', () => {
    const { shared } = buildHeroOverlap([{ ana: played(5, 60) }, { ana: played(5, 40) }])

    expect(shared[0].leaders).toEqual([0])
  })

  it('makes every Player tied for the best win rate a Leader', () => {
    const { shared } = buildHeroOverlap([{ ana: played(5, 60) }, { ana: played(5, 60) }, { ana: played(5, 40) }])

    expect(shared[0].leaders).toEqual([0, 1])
  })

  it('has no Leader when every compared Player is tied', () => {
    const { shared } = buildHeroOverlap([{ ana: played(5, 60) }, { ana: played(5, 60) }])

    expect(shared[0].leaders).toEqual([])
  })

  it('does not let a Player under 3 games lead, or count them as compared', () => {
    const { shared } = buildHeroOverlap([{ ana: played(2, 100) }, { ana: played(3, 40) }, { ana: played(10, 50) }])

    expect(shared[0].results.map((r) => r?.comparable)).toEqual([false, true, true])
    expect(shared[0].leaders).toEqual([2])
  })

  it('has no Leader when fewer than two Players have 3 games', () => {
    const { shared } = buildHeroOverlap([{ ana: played(2, 100) }, { ana: played(30, 40) }])

    expect(shared).toHaveLength(1)
    expect(shared[0].leaders).toEqual([])
  })

  it('lists heroes that can have a Leader first, then by combined time played', () => {
    expect(
      sharedKeys([
        { ana: played(1, 60, 9000), mercy: played(5, 60, 100), lucio: played(5, 60, 500) },
        { ana: played(1, 60, 9000), mercy: played(5, 40, 100), lucio: played(5, 40, 500) },
      ]),
    ).toEqual(['lucio', 'mercy', 'ana'])
  })
})

describe('Shared Hero tally', () => {
  it('counts the Shared Heroes each Player leads, out of those with a Leader', () => {
    const { tally } = buildHeroOverlap([
      { ana: played(5, 60), mercy: played(5, 60), lucio: played(5, 50), genji: played(1, 100) },
      { ana: played(5, 40), mercy: played(5, 70), lucio: played(5, 50), genji: played(1, 0) },
    ])

    // Lucio is tied and Genji is under 3 games, so only Ana and Mercy have a Leader.
    expect(tally).toEqual([
      { leads: 1, of: 2 },
      { leads: 1, of: 2 },
    ])
  })

  it('counts a shared lead for every Player tied for it', () => {
    const { tally } = buildHeroOverlap([{ ana: played(5, 60) }, { ana: played(5, 60) }, { ana: played(5, 40) }])

    expect(tally).toEqual([
      { leads: 1, of: 1 },
      { leads: 1, of: 1 },
      { leads: 0, of: 1 },
    ])
  })

  it('leaves out Players with no Hero Pool, or nothing in it', () => {
    const { tally } = buildHeroOverlap([
      { ana: played(5, 60) },
      null,
      { ana: played(5, 40) },
      { reaper: played(0, 0) },
    ])

    expect(tally).toEqual([{ leads: 1, of: 1 }, null, { leads: 0, of: 1 }, null])
  })
})
