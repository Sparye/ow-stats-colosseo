import { isSamePlayer, parseBattleTag, type BattleTag } from './battleTag'

export const GAMEMODES = ['competitive', 'quickplay'] as const
export const PLATFORMS = ['pc', 'console'] as const
export const ALL_HEROES = 'all-heroes'
export const MAX_PLAYERS = 5

export type Gamemode = (typeof GAMEMODES)[number]
export type Platform = (typeof PLATFORMS)[number]

/** Everything that defines a Matchup, as it lives in the URL. */
export type MatchupSearch = {
  /** Player ids (`Name-1234`) in Slot order. */
  players: string[]
  /** A hero key, or `all-heroes`. */
  hero: string
  gamemode: Gamemode
  platform: Platform
}

const HERO_KEY = /^[a-z0-9-]+$/

export function parseMatchupSearch(query: string): MatchupSearch {
  const params = new URLSearchParams(query)
  const hero = params.get('hero') ?? ''
  return {
    players: parsePlayers(params.get('players') ?? ''),
    hero: HERO_KEY.test(hero) ? hero : ALL_HEROES,
    gamemode: oneOf(GAMEMODES, params.get('gamemode')) ?? 'competitive',
    platform: oneOf(PLATFORMS, params.get('platform')) ?? 'pc',
  }
}

export function stringifyMatchupSearch(search: MatchupSearch): string {
  const entries: Array<[string, string]> = []
  if (search.players.length > 0) entries.push(['players', search.players.join(',')])
  entries.push(['hero', search.hero], ['gamemode', search.gamemode], ['platform', search.platform])
  // Only escape what would break the query string, so shared links stay readable.
  const escape = (value: string) => value.replace(/[%&#+=?\s]/g, encodeURIComponent)
  return '?' + entries.map(([k, v]) => `${k}=${escape(v)}`).join('&')
}

function parsePlayers(raw: string): string[] {
  const tags: BattleTag[] = []
  for (const part of raw.split(',')) {
    const parsed = parseBattleTag(part)
    if (!parsed.ok || tags.some((t) => isSamePlayer(t, parsed.tag))) continue
    tags.push(parsed.tag)
  }
  return tags.slice(0, MAX_PLAYERS).map((t) => t.id)
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T | undefined {
  return options.find((o) => o === value)
}
