import type { Hero, PlayerSummary, Rank } from '../api/overfast'
import type { Platform } from '../domain/matchupSearch'

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

/** OverFast reports durations in seconds and percentages as whole numbers. */
export function formatStat(key: string, value: number): string {
  if (/(^|_)time(_|$)/.test(key)) return formatDuration(value)
  if (key.includes('percentage') || key.includes('accuracy')) return `${number.format(value)}%`
  return number.format(value)
}

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${number.format(hours)}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

const DIVISIONS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion']

/** Tier 5 is the bottom of a division and tier 1 the top. */
const rankValue = (rank: Rank) => DIVISIONS.indexOf(rank.division) * 10 + (6 - rank.tier)

/** The rank for the hero's role, or the Player's highest role rank for All Heroes. */
export function rankFor(summary: PlayerSummary, platform: Platform, hero: Hero | undefined): Rank | null {
  const ranks = summary.competitive?.[platform]
  if (!ranks) return null
  if (hero) return ranks[hero.role] ?? null
  const all = Object.values(ranks).filter((r): r is Rank => !!r && typeof r === 'object' && 'division' in r)
  return all.sort((a, b) => rankValue(b) - rankValue(a))[0] ?? null
}

export const rankLabel = (rank: Rank) => `${rank.division[0].toUpperCase()}${rank.division.slice(1)} ${rank.tier}`
