import { isSamePlayer, parseBattleTag } from './battleTag'

export const MAX_RECENT_PLAYERS = 20

/** Moves a Player to the front of the Recent Players, replacing any copy that differs only by case. */
export function rememberPlayer(recent: readonly string[], playerId: string): string[] {
  const parsed = parseBattleTag(playerId)
  if (!parsed.ok) return [...recent]
  const others = recent.filter((id) => {
    const other = parseBattleTag(id)
    return other.ok && !isSamePlayer(other.tag, parsed.tag)
  })
  return [parsed.tag.id, ...others].slice(0, MAX_RECENT_PLAYERS)
}

/** Reads Recent Players back from storage, dropping anything that isn't a BattleTag. */
export function parseRecentPlayers(stored: string | null): string[] {
  try {
    const value: unknown = JSON.parse(stored ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((id): id is string => typeof id === 'string' && parseBattleTag(id).ok)
  } catch {
    return []
  }
}
