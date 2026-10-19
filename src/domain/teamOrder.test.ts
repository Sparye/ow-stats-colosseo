import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEAM_ORDER, TEAMS, loadTeamOrder, saveTeamOrder } from './teamOrder'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Team Order', () => {
  it('defaults to Dallas, Shanghai, Houston, Gladiators, Hangzhou', () => {
    expect(DEFAULT_TEAM_ORDER).toEqual(['DAL', 'SHD', 'HOU', 'GLA', 'HZS'])
    expect(loadTeamOrder()).toEqual(DEFAULT_TEAM_ORDER)
  })

  it('knows all 20 Overwatch League teams', () => {
    expect(Object.keys(TEAMS)).toHaveLength(20)
    expect(TEAMS.HZS).toEqual({ code: 'HZS', name: 'Hangzhou Spark', color: '#FB7299' })
  })

  it('remembers a saved order', () => {
    saveTeamOrder(['NYE', 'SFS', 'VAN', 'PHI', 'LDN'])
    expect(loadTeamOrder()).toEqual(['NYE', 'SFS', 'VAN', 'PHI', 'LDN'])
  })

  it.each([
    ['not JSON', '{nope'],
    ['the wrong length', '["DAL","SHD"]'],
    ['an unknown team', '["DAL","SHD","HOU","GLA","XYZ"]'],
    ['a team used twice', '["DAL","DAL","HOU","GLA","HZS"]'],
  ])('falls back to the default when storage holds %s', (_, stored) => {
    localStorage.setItem('colosseo.teamOrder', stored)
    expect(loadTeamOrder()).toEqual(DEFAULT_TEAM_ORDER)
  })

  it('quietly uses the default when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(() => saveTeamOrder(['NYE', 'SFS', 'VAN', 'PHI', 'LDN'])).not.toThrow()
    expect(loadTeamOrder()).toEqual(DEFAULT_TEAM_ORDER)
  })
})
