import { describe, expect, it } from 'vitest'
import { updatedAgo } from './lastUpdated'

const NOW = new Date('2026-11-04T12:00:00Z')
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('updatedAgo', () => {
  it.each([
    [0, 'Updated just now'],
    [59, 'Updated just now'],
    [MINUTE, 'Updated 1 min ago'],
    [3 * MINUTE + 59, 'Updated 3 min ago'],
    [59 * MINUTE, 'Updated 59 min ago'],
    [HOUR, 'Updated 1 hr ago'],
    [23 * HOUR, 'Updated 23 hr ago'],
    [DAY, 'Updated 1 day ago'],
    [29 * DAY, 'Updated 29 days ago'],
    [30 * DAY, 'Updated 1 month ago'],
    [180 * DAY, 'Updated 6 months ago'],
    [364 * DAY, 'Updated 12 months ago'],
    [365 * DAY, 'Updated 1 year ago'],
    [3 * 365 * DAY, 'Updated 3 years ago'],
  ])('%i seconds back reads "%s"', (seconds, text) => {
    expect(updatedAgo(secondsAgo(seconds), NOW)).toBe(text)
  })

  it('reads as just now when the time is ahead of this device clock', () => {
    expect(updatedAgo(secondsAgo(-5 * MINUTE), NOW)).toBe('Updated just now')
  })
})
