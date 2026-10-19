export type BattleTag = {
  name: string
  discriminator: string
  /** `Name-1234`, the form OverFast and our URLs use. */
  id: string
  /** `Name#1234`, the form players recognise. */
  display: string
}

export type ParseResult = { ok: true; tag: BattleTag } | { ok: false; error: string }

const BATTLE_TAG = /^([\p{L}\p{N}]+)[#-](\d{3,})$/u

export function parseBattleTag(input: string): ParseResult {
  const match = BATTLE_TAG.exec(input.trim())
  if (!match) return { ok: false, error: 'Enter a BattleTag like Name#1234' }
  const [, name, discriminator] = match
  return {
    ok: true,
    tag: { name, discriminator, id: `${name}-${discriminator}`, display: `${name}#${discriminator}` },
  }
}

export function isSamePlayer(a: BattleTag, b: BattleTag): boolean {
  return a.id.toLowerCase() === b.id.toLowerCase()
}
