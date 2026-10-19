import { describe, expect, it } from 'vitest'
import { buildComparison, type HeroStats } from './comparison'

/** Builds OverFast-shaped hero stats from `{ category: { key: value } }`. */
function heroStats(categories: Record<string, Record<string, number>>): HeroStats {
  return Object.entries(categories).map(([category, stats]) => ({
    category,
    label: category,
    stats: Object.entries(stats).map(([key, value]) => ({ key, label: key, value })),
  }))
}

function row(comparison: ReturnType<typeof buildComparison>, key: string) {
  const all = [...comparison.sample, ...comparison.fair, ...comparison.volume, ...comparison.best]
  const found = all.find((r) => r.key === key)
  if (!found) throw new Error(`no row ${key}`)
  return found
}

describe('buildComparison: Leader', () => {
  it('leads with the higher value', () => {
    const c = buildComparison([
      heroStats({ average: { eliminations_avg_per_10_min: 20 } }),
      heroStats({ average: { eliminations_avg_per_10_min: 15.5 } }),
    ])
    expect(row(c, 'eliminations_avg_per_10_min')).toMatchObject({ values: [20, 15.5], leaders: [0] })
  })

  it('leads with the lower value on a Lower-Is-Better Stat', () => {
    const c = buildComparison([
      heroStats({ average: { deaths_avg_per_10_min: 6 } }),
      heroStats({ average: { deaths_avg_per_10_min: 4.2 } }),
    ])
    expect(row(c, 'deaths_avg_per_10_min').leaders).toEqual([1])
  })

  it('has no Leader when every compared Player is tied', () => {
    const c = buildComparison([
      heroStats({ game: { win_percentage: 50 } }),
      heroStats({ game: { win_percentage: 50 } }),
      heroStats({ game: { win_percentage: 50 } }),
    ])
    expect(row(c, 'win_percentage').leaders).toEqual([])
  })

  it('makes every Player tied for best a Leader', () => {
    const c = buildComparison([
      heroStats({ game: { win_percentage: 12 } }),
      heroStats({ game: { win_percentage: 12 } }),
      heroStats({ game: { win_percentage: 9 } }),
    ])
    expect(row(c, 'win_percentage').leaders).toEqual([0, 1])
  })

  it('compares only Players who have the stat', () => {
    const c = buildComparison([
      heroStats({ hero_specific: { scoped_accuracy: 40 } }),
      heroStats({ hero_specific: {} }),
      heroStats({ hero_specific: { scoped_accuracy: 55 } }),
    ])
    expect(row(c, 'scoped_accuracy')).toMatchObject({ values: [40, null, 55], leaders: [2] })
  })

  it('needs at least two values to have a Leader', () => {
    const c = buildComparison([heroStats({ hero_specific: { scoped_accuracy: 40 } }), null])
    expect(row(c, 'scoped_accuracy')).toMatchObject({ values: [40, null], leaders: [] })
  })

  it('never gives Sample Size rows a Leader', () => {
    const c = buildComparison([
      heroStats({ game: { time_played: 3600, games_played: 10 } }),
      heroStats({ game: { time_played: 60, games_played: 1 } }),
    ])
    expect(c.sample.map((r) => [r.key, r.leaders])).toEqual([
      ['time_played', []],
      ['games_played', []],
    ])
  })
})

describe('buildComparison: sections', () => {
  it('sorts rows into Fair, Volume and Best, with hero-specific Fair Stats first', () => {
    const c = buildComparison([
      heroStats({
        average: { eliminations_avg_per_10_min: 10 },
        hero_specific: { enemies_slept_avg_per_10_min: 3, enemies_slept: 40, enemies_slept_most_in_game: 9 },
        combat: { eliminations: 100 },
      }),
      heroStats({}),
    ])
    expect(c.fair.map((r) => r.key)).toEqual(['enemies_slept_avg_per_10_min', 'eliminations_avg_per_10_min'])
    expect(c.volume.map((r) => r.key)).toEqual(['enemies_slept', 'eliminations'])
    expect(c.best.map((r) => r.key)).toEqual(['enemies_slept_most_in_game'])
  })

  it('shows a stat that appears in several categories only once', () => {
    const c = buildComparison([
      heroStats({ assists: { healing_done_most_in_game: 9000 }, best: { healing_done_most_in_game: 9000 } }),
      heroStats({}),
    ])
    expect(c.best.map((r) => r.key)).toEqual(['healing_done_most_in_game'])
  })
})

describe('buildComparison: Score', () => {
  it('counts Fair Stat leads out of Fair Stat rows that have a Leader', () => {
    const c = buildComparison([
      heroStats({
        game: { win_percentage: 60, games_played: 1 },
        average: { eliminations_avg_per_10_min: 20, deaths_avg_per_10_min: 5, healing_done_avg_per_10_min: 100 },
        combat: { eliminations: 1 },
      }),
      heroStats({
        game: { win_percentage: 40, games_played: 99 },
        average: { eliminations_avg_per_10_min: 20, deaths_avg_per_10_min: 4, healing_done_avg_per_10_min: 50 },
        combat: { eliminations: 999 },
      }),
      heroStats({
        game: { win_percentage: 50 },
        average: { eliminations_avg_per_10_min: 10 },
      }),
    ])
    // Fair rows with a Leader: win % (P0), elims (P0+P1 shared), deaths (P1), healing (P0).
    expect(c.scores).toEqual([
      { leads: 3, of: 4 },
      { leads: 2, of: 4 },
      { leads: 0, of: 4 },
    ])
  })

  it('has no Score for a Player with no stats', () => {
    const c = buildComparison([heroStats({ game: { win_percentage: 60 } }), null])
    expect(c.scores[1]).toBeNull()
  })
})
