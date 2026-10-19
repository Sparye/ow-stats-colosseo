import type { HeroStats } from '../domain/comparison'
import type { Gamemode, Platform } from '../domain/matchupSearch'

// Every OverFast call goes through this module (see ADR 0001).
const BASE_URL = (import.meta.env.VITE_OVERFAST_URL ?? 'https://overfast-api.tekrop.fr').replace(/\/$/, '')

export class OverfastError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const isNotFound = (error: unknown) => error instanceof OverfastError && error.status === 404

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok) throw new OverfastError(response.status, `OverFast ${response.status} on ${path}`)
  return response.json() as Promise<T>
}

export type Role = 'tank' | 'damage' | 'support'

export type Hero = { key: string; name: string; portrait: string; role: Role }

export type Rank = {
  division: string
  tier: number
  rank_icon: string
}

/** A Player's ranks on one Platform, plus the season their Competitive stats come from. */
export type CompetitiveSummary = Partial<Record<Role | 'open', Rank | null>> & {
  /** The last season the Player played; Blizzard only shows Competitive stats for that one. */
  season?: number | null
}

export type PlayerSummary = {
  username: string
  avatar: string | null
  competitive: Partial<Record<Platform, CompetitiveSummary | null>> | null
}

/** Stats for every hero the Player has played, keyed by hero key (plus `all-heroes`). */
export type PlayerStats = Record<string, HeroStats | null>

export const getHeroes = () => get<Hero[]>('/heroes')

export const getPlayerSummary = (playerId: string) =>
  get<PlayerSummary>(`/players/${encodeURIComponent(playerId)}/summary`)

export const getPlayerStats = (playerId: string, gamemode: Gamemode, platform: Platform) =>
  get<PlayerStats | null>(`/players/${encodeURIComponent(playerId)}/stats?gamemode=${gamemode}&platform=${platform}`)

/**
 * Whether a Player's career is public. OverFast returns the same empty stats for
 * a Private Profile and for a Player with no games, so ask the search instead.
 */
export async function isPublicProfile(playerId: string): Promise<boolean> {
  const { results } = await get<{ results: Array<{ player_id: string; is_public: boolean }> }>(
    `/players?name=${encodeURIComponent(playerId)}`,
  )
  return results.find((r) => r.player_id === playerId)?.is_public ?? true
}
