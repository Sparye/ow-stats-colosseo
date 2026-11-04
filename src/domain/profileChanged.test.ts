import { describe, expect, it } from 'vitest'
import { profileChangedAgo } from './profileChanged'

const NOW = new Date('2026-11-04T12:00:00Z')
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('profileChangedAgo', () => {
  it.each([
    [0, 'Profile changed just now'],
    [59, 'Profile changed just now'],
    [MINUTE, 'Profile changed 1 min ago'],
    [3 * MINUTE + 59, 'Profile changed 3 min ago'],
    [59 * MINUTE, 'Profile changed 59 min ago'],
    [HOUR, 'Profile changed 1 hr ago'],
    [23 * HOUR, 'Profile changed 23 hr ago'],
    [DAY, 'Profile changed 1 day ago'],
    [29 * DAY, 'Profile changed 29 days ago'],
    [30 * DAY, 'Profile changed 1 mo ago'],
    [180 * DAY, 'Profile changed 6 mo ago'],
    [364 * DAY, 'Profile changed 12 mo ago'],
    [365 * DAY, 'Profile changed 1 yr ago'],
    [3 * 365 * DAY, 'Profile changed 3 yr ago'],
  ])('%i seconds back reads "%s"', (seconds, text) => {
    expect(profileChangedAgo(secondsAgo(seconds), NOW)).toBe(text)
  })

  it('reads as just now when the time is ahead of this device clock', () => {
    expect(profileChangedAgo(secondsAgo(-5 * MINUTE), NOW)).toBe('Profile changed just now')
  })
})
