import { describe, expect, it } from 'vitest'
import { isLowerBetter, statKind } from './statKind'

describe('statKind', () => {
  it.each([
    ['time_played', 'sample'],
    ['games_played', 'sample'],
    ['win_percentage', 'fair'],
    ['healing_done_avg_per_10_min', 'fair'],
    ['eliminations_per_life', 'fair'],
    ['weapon_accuracy', 'fair'],
    ['scoped_accuracy', 'fair'],
    ['sleep_dart_accuracy', 'fair'],
    ['healing_done_most_in_game', 'best'],
    ['eliminations_most_in_life', 'best'],
    ['kill_streak_best', 'best'],
    ['weapon_accuracy_best_in_game', 'best'],
    ['scoped_accuracy_best_in_game', 'best'],
    ['healing_done', 'volume'],
    ['enemies_slept', 'volume'],
    ['games_won', 'volume'],
    ['deaths', 'volume'],
  ] as const)('%s is a %s stat', (key, kind) => {
    expect(statKind(key)).toBe(kind)
  })
})

describe('isLowerBetter', () => {
  it.each(['deaths', 'deaths_avg_per_10_min', 'environmental_deaths'])('%s is lower-is-better', (key) => {
    expect(isLowerBetter(key)).toBe(true)
  })

  it.each(['eliminations', 'healing_done_avg_per_10_min', 'win_percentage'])('%s is higher-is-better', (key) => {
    expect(isLowerBetter(key)).toBe(false)
  })
})
