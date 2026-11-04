import { describe, expect, it } from 'vitest'
import { averageRegions, highestRankTier, rankAdjustedWinRate, rankTierOf } from './benchmark'

describe('averageRegions', () => {
  const ana = (winrate: number, pickrate: number, banrate?: number | null) => ({ hero: 'ana', winrate, pickrate, banrate })

  it('counts every region equally and rounds to the API’s one decimal', () => {
    expect(
      averageRegions([[ana(50, 20, 10)], [ana(47.2, 33, 4)], [ana(47.3, 28, 4.3)]], 'ana'),
    ).toEqual({ winrate: 48.2, pickrate: 27, banrate: 6.1 })
  })

  it('passes a single region through', () => {
    expect(averageRegions([[ana(47.5, 23.8, 11.5)]], 'ana')).toEqual({ winrate: 47.5, pickrate: 23.8, banrate: 11.5 })
  })

  it('finds the hero in the full list', () => {
    expect(averageRegions([[{ hero: 'mercy', winrate: 1, pickrate: 1 }, ana(50, 20)]], 'ana')?.winrate).toBe(50)
  })

  it('has no ban rate when no region reports one, as in Quick Play', () => {
    expect(averageRegions([[ana(50, 20)], [ana(40, 10, null)]], 'ana')).toEqual({ winrate: 45, pickrate: 15, banrate: null })
  })

  it('averages only the regions that answered', () => {
    expect(averageRegions([[ana(50, 20, 10)], undefined, [ana(40, 10, 20)]], 'ana')).toEqual({
      winrate: 45,
      pickrate: 15,
      banrate: 15,
    })
  })

  it('skips a region without the hero', () => {
    expect(averageRegions([[ana(50, 20)], [{ hero: 'mercy', winrate: 1, pickrate: 1 }]], 'ana')?.winrate).toBe(50)
  })

  it('is null when no region has the hero', () => {
    expect(averageRegions([undefined, []], 'ana')).toBeNull()
  })
})

describe('rankTierOf', () => {
  it('keeps a division OverFast can filter by', () => {
    expect(rankTierOf('emerald')).toBe('emerald')
  })

  it("counts the top division as Grandmaster, which OverFast's filter includes it in", () => {
    expect(rankTierOf('ultimate')).toBe('grandmaster')
    expect(rankTierOf('champion')).toBe('grandmaster')
  })

  it('has no tier for no rank or an unknown division', () => {
    expect(rankTierOf(null)).toBeNull()
    expect(rankTierOf(undefined)).toBeNull()
    expect(rankTierOf('wood')).toBeNull()
  })
})

describe('highestRankTier', () => {
  it('picks the highest, including the divisions in the middle', () => {
    expect(highestRankTier(['gold', 'emerald', 'platinum'])).toBe('emerald')
    expect(highestRankTier(['ultimate', 'master'])).toBe('grandmaster')
  })

  it('ignores Players without a rank', () => {
    expect(highestRankTier([null, 'silver', undefined])).toBe('silver')
  })

  it('is null when nobody has a rank', () => {
    expect(highestRankTier([null, undefined])).toBeNull()
    expect(highestRankTier([])).toBeNull()
  })
})

describe('rankAdjustedWinRate', () => {
  it('is how far above or below the global win rate a Player is', () => {
    expect(rankAdjustedWinRate(55, 50.8)).toBe(4.2)
    expect(rankAdjustedWinRate(47, 50.8)).toBe(-3.8)
  })

  it('rounds to the one decimal on show, so two equal-looking values tie', () => {
    expect(rankAdjustedWinRate(55, 50.8)).toBe(rankAdjustedWinRate(54, 49.8))
  })

  it('has no negative zero', () => {
    expect(Object.is(rankAdjustedWinRate(50, 50), 0)).toBe(true)
    expect(Object.is(rankAdjustedWinRate(50, 50.04), 0)).toBe(true)
  })
})
