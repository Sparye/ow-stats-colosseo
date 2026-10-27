import { describe, expect, it } from 'vitest'
import { parseMatchupSearch, stringifyMatchupSearch, type MatchupSearch } from './matchupSearch'

describe('parseMatchupSearch', () => {
  it('reads a shared Matchup link', () => {
    expect(
      parseMatchupSearch('?players=TeKrop-2217,Other-5678&hero=ana&gamemode=quickplay&platform=console'),
    ).toEqual({
      players: ['TeKrop-2217', 'Other-5678'],
      hero: 'ana',
      gamemode: 'quickplay',
      platform: 'console',
      stats: 'fair',
    })
  })

  it('reads which stats a link opens on', () => {
    expect(parseMatchupSearch('?stats=best').stats).toBe('best')
    expect(parseMatchupSearch('?stats=everything').stats).toBe('fair')
  })

  it('falls back to All Heroes, Competitive and PC', () => {
    expect(parseMatchupSearch('')).toEqual({
      players: [],
      hero: 'all-heroes',
      gamemode: 'competitive',
      platform: 'pc',
      stats: 'fair',
    })
  })

  it('replaces invalid values with the defaults', () => {
    expect(parseMatchupSearch('?hero=<script>&gamemode=arcade&platform=switch')).toMatchObject({
      hero: 'all-heroes',
      gamemode: 'competitive',
      platform: 'pc',
    })
  })

  it('drops malformed and duplicate BattleTags, and anything after the 5th Player', () => {
    expect(parseMatchupSearch('?players=A-1111,nope,a-1111,B-2222,C-3333,D-4444,E-5555,F-6666').players).toEqual([
      'A-1111',
      'B-2222',
      'C-3333',
      'D-4444',
      'E-5555',
    ])
  })

  it('accepts BattleTags typed with # in the URL', () => {
    expect(parseMatchupSearch('?players=TeKrop%232217').players).toEqual(['TeKrop-2217'])
  })
})

describe('stringifyMatchupSearch', () => {
  it('writes a readable, shareable query string', () => {
    expect(
      stringifyMatchupSearch({
        players: ['TeKrop-2217', 'Other-5678'],
        hero: 'ana',
        gamemode: 'competitive',
        platform: 'pc',
        stats: 'fair',
      }),
    ).toBe('?players=TeKrop-2217,Other-5678&hero=ana&gamemode=competitive&platform=pc')
  })

  it('adds the stats only when they are not Fair Stats', () => {
    expect(
      stringifyMatchupSearch({ players: [], hero: 'ana', gamemode: 'competitive', platform: 'pc', stats: 'volume' }),
    ).toBe('?hero=ana&gamemode=competitive&platform=pc&stats=volume')
  })

  it('keeps non-Latin names readable and round-trips them', () => {
    const search: MatchupSearch = { players: ['홍길동-31337'], hero: 'all-heroes', gamemode: 'competitive', platform: 'pc', stats: 'fair' }
    const query = stringifyMatchupSearch(search)
    expect(query).toContain('홍길동-31337')
    expect(parseMatchupSearch(query)).toEqual(search)
  })

  it('leaves out players when there are none', () => {
    expect(
      stringifyMatchupSearch({ players: [], hero: 'all-heroes', gamemode: 'competitive', platform: 'pc', stats: 'fair' }),
    ).toBe('?hero=all-heroes&gamemode=competitive&platform=pc')
  })
})
