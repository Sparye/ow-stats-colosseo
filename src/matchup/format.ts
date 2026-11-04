import type { Hero, PlayerSummary, Rank } from '../api/overfast'
import { REGIONS, type RankTier, type Region } from '../domain/benchmark'
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

const capitalized = (word: string) => `${word[0].toUpperCase()}${word.slice(1)}`

export const tierLabel = (tier: RankTier) => capitalized(tier)

export const regionLabel = (region: Region) => capitalized(region)

/** "+4.2", or "−3.8" with a real minus sign. */
export const formatDifference = (difference: number) =>
  `${difference < 0 ? '−' : '+'}${number.format(Math.abs(difference))}`

/** Where global hero stats on show come from, for hovering; `missing` lists the regions that didn't answer. */
export function regionsNote(region: Region | 'all', missing: Region[]): string {
  if (region !== 'all') return `${regionLabel(region)} only`
  const answered = REGIONS.filter((r) => !missing.includes(r)).map(regionLabel)
  const list = `${answered.slice(0, -1).join(', ')}${answered.length > 1 ? ' and ' : ''}${answered.at(-1)}`
  const average = `Average of ${list}, each counted equally`
  return missing.length === 0 ? average : `${average}. ${missing.map(regionLabel).join(' and ')} didn't load.`
}
