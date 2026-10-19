import { describe, expect, it } from 'vitest'
import { isSamePlayer, parseBattleTag } from './battleTag'

describe('parseBattleTag', () => {
  it('turns a typed BattleTag into the id OverFast expects', () => {
    expect(parseBattleTag('TeKrop#2217')).toEqual({
      ok: true,
      tag: { name: 'TeKrop', discriminator: '2217', id: 'TeKrop-2217', display: 'TeKrop#2217' },
    })
  })

  it('accepts the URL form with a dash and trims whitespace', () => {
    const result = parseBattleTag('  TeKrop-2217 ')
    expect(result.ok && result.tag.display).toBe('TeKrop#2217')
  })

  it('accepts non-Latin names', () => {
    const result = parseBattleTag('홍길동#31337')
    expect(result.ok && result.tag.id).toBe('홍길동-31337')
  })

  it.each(['TeKrop', 'TeKrop#', '#2217', 'TeKrop#abcd', 'Te Krop#2217', ''])(
    'rejects malformed input %j',
    (input) => {
      expect(parseBattleTag(input).ok).toBe(false)
    },
  )
})

describe('isSamePlayer', () => {
  it('ignores case, since BattleTags only differ by case through typos', () => {
    const a = parseBattleTag('TeKrop#2217')
    const b = parseBattleTag('tekrop-2217')
    if (!a.ok || !b.ok) throw new Error('fixture should parse')
    expect(isSamePlayer(a.tag, b.tag)).toBe(true)
  })
})
