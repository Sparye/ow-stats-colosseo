import { RANK_TIERS, REGIONS, type RankTier, type Region } from '../domain/benchmark'
import { regionsNote, regionLabel, tierLabel } from './format'
import type { GlobalStats } from './useGlobalStats'

type Props = {
  heroName: string
  /** The Rank Tier on show. `null` is all ranks; `undefined` means still waiting for the Players' ranks. */
  tier: RankTier | null | undefined
  /** Whether a tier can be picked at all: Quick Play has no ranks. */
  hasTiers: boolean
  onTierChange: (tier: RankTier | 'all') => void
  region: Region | 'all'
  onRegionChange: (region: Region | 'all') => void
  stats: GlobalStats
}

/** Heads the Benchmark's column, the field to compare the Players with. It isn't a Slot, so it has no BattleTag. */
export function BenchmarkHeader({ heroName, tier, hasTiers, onTierChange, region, onRegionChange, stats }: Props) {
  const title = ['Avg', tier && tierLabel(tier), heroName].filter(Boolean).join(' ')
  const ready = stats.status === 'ready' ? stats : null

  return (
    <div className="benchmark-header" role="columnheader" aria-label="Benchmark">
      <div className="slot-strip" />
      <div className="benchmark-title" title="Everyone playing this hero, not a Player in this Matchup">
        {title}
      </div>
      <div className="benchmark-pickers">
        {hasTiers && (
          <select
            aria-label="Rank tier"
            value={tier ?? 'all'}
            disabled={tier === undefined}
            onChange={(event) => onTierChange(event.target.value as RankTier | 'all')}
          >
            <option value="all">All ranks</option>
            {RANK_TIERS.map((t) => (
              <option key={t} value={t}>
                {tierLabel(t)}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Region"
          title={regionsNote(region, ready?.missing ?? [])}
          value={region}
          onChange={(event) => onRegionChange(event.target.value as Region | 'all')}
        >
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {regionLabel(r)}
            </option>
          ))}
        </select>
      </div>
      <div className="benchmark-rates">
        {stats.status === 'loading' && 'Loading…'}
        {stats.status === 'failed' && (
          <>
            Couldn't load{' '}
            <button type="button" className="link" onClick={stats.retry}>
              Retry
            </button>
          </>
        )}
        {ready && !ready.stats && 'No data for this hero'}
        {ready?.stats && (
          <>
            <span>Pick {ready.stats.pickrate}%</span>
            {ready.stats.banrate !== null && <span>Ban {ready.stats.banrate}%</span>}
          </>
        )}
      </div>
    </div>
  )
}
