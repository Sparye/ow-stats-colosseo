import { describe, expect, it } from 'vitest'
import { MAX_RECENT_PLAYERS, parseRecentPlayers, rememberPlayer } from './recentPlayers'

describe('rememberPlayer', () => {
  it('puts the newest Player first', () => {
    expect(rememberPlayer(['Anna-1111'], 'Bob-2222')).toEqual(['Bob-2222', 'Anna-1111'])
  })

  it('moves a Player seen before to the front, keeping the casing that last loaded', () => {
    expect(rememberPlayer(['anna-1111', 'Bob-2222'], 'Anna-1111')).toEqual(['Anna-1111', 'Bob-2222'])
  })

  it(`keeps only the ${MAX_RECENT_PLAYERS} most recent`, () => {
    const full = Array.from({ length: MAX_RECENT_PLAYERS }, (_, i) => `P${i}-1000`)
    const next = rememberPlayer(full, 'New-9999')
    expect(next).toHaveLength(MAX_RECENT_PLAYERS)
    expect(next[0]).toBe('New-9999')
    expect(next).not.toContain(full.at(-1))
  })
})

describe('parseRecentPlayers', () => {
  it('drops entries that are not BattleTags', () => {
    expect(parseRecentPlayers(JSON.stringify(['Anna-1111', 42, 'nonsense']))).toEqual(['Anna-1111'])
  })

  it.each([null, '', 'not json', '{"a":1}'])('treats %j as no Recent Players', (stored) => {
    expect(parseRecentPlayers(stored)).toEqual([])
  })
})
