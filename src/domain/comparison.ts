import { isLowerBetter, statKind } from './statKind'

/** One hero's stats for one Player, as OverFast's `/players/{id}/stats` returns them. */
export type HeroStats = Array<{
  category: string
  label: string
  stats: Array<{ key: string; label: string; value: number }>
}>

export type StatRow = {
  key: string
  label: string
  /** One value per Slot; `null` where that Player doesn't have the stat. */
  values: Array<number | null>
  /** Slot indices of this row's Leaders. */
  leaders: number[]
}

export type Score = { leads: number; of: number }

export type Comparison = {
  sample: StatRow[]
  fair: StatRow[]
  volume: StatRow[]
  best: StatRow[]
  /** One per Slot; `null` for a Slot with no stats. */
  scores: Array<Score | null>
}

const SAMPLE_ORDER = ['time_played', 'games_played']

/**
 * Lines up each Slot's stats into Stat Rows, finds each row's Leaders and
 * counts every Player's Score. Pass `null` for a Slot with no stats to compare
 * (empty, loading, private, or hasn't played the hero).
 */
export function buildComparison(slots: Array<HeroStats | null>): Comparison {
  const labels = new Map<string, string>()
  const valuesBySlot = slots.map((categories) => {
    const values = new Map<string, number>()
    for (const { stats } of heroSpecificFirst(categories ?? [])) {
      for (const { key, label, value } of stats) {
        if (!labels.has(key)) labels.set(key, label)
        if (!values.has(key)) values.set(key, value)
      }
    }
    return values
  })

  const comparison: Comparison = { sample: [], fair: [], volume: [], best: [], scores: [] }
  for (const [key, label] of labels) {
    const values = valuesBySlot.map((v) => v.get(key) ?? null)
    const kind = statKind(key)
    const leaders = kind === 'sample' ? [] : findLeaders(values, isLowerBetter(key))
    comparison[kind].push({ key, label, values, leaders })
  }
  comparison.sample.sort((a, b) => SAMPLE_ORDER.indexOf(a.key) - SAMPLE_ORDER.indexOf(b.key))

  const contested = comparison.fair.filter((r) => r.leaders.length > 0)
  comparison.scores = slots.map((stats, slot) =>
    stats ? { leads: contested.filter((r) => r.leaders.includes(slot)).length, of: contested.length } : null,
  )
  return comparison
}

function heroSpecificFirst(categories: HeroStats): HeroStats {
  return [
    ...categories.filter((c) => c.category === 'hero_specific'),
    ...categories.filter((c) => c.category !== 'hero_specific'),
  ]
}

function findLeaders(values: Array<number | null>, lowerIsBetter: boolean): number[] {
  const compared = values.flatMap((value, slot) => (value === null ? [] : [{ value, slot }]))
  if (compared.length < 2) return []
  const best = lowerIsBetter
    ? Math.min(...compared.map((c) => c.value))
    : Math.max(...compared.map((c) => c.value))
  const leaders = compared.filter((c) => c.value === best).map((c) => c.slot)
  return leaders.length === compared.length ? [] : leaders
}
