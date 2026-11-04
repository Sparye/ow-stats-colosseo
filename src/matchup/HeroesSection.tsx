import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Hero } from '../api/overfast'
import { MIN_GAMES, type HeroResult, type PoolHero, type SharedHero } from '../domain/heroOverlap'
import { SLOT_COLORS } from '../domain/slotColors'
import { formatStat } from './format'
import type { HeroOverlapState, PoolStatus } from './useHeroOverlap'

/** How many of a Player's heroes show before "+N more". */
const TOP_HEROES = 8

type Props = {
  overlap: HeroOverlapState
  /** Every hero's name and portrait; a hero not in here falls back to its key. */
  heroes: Hero[] | undefined
  mirrored: boolean
  onHeroSelect: (heroKey: string) => void
}

/**
 * The Heroes section: each Player's Hero Pool, then every Shared Hero head to
 * head. It uses the Stat Rows' grid, so each Player's heroes and numbers sit
 * under their header in both the two-Player and the 3-5 Player layout.
 */
export function HeroesSection({ overlap, heroes, mirrored, onHeroSelect }: Props) {
  const { pools, shared, tally, statuses } = overlap
  const heroFor = (key: string) => heroes?.find((h) => h.key === key)
  const nameOf = (key: string) => heroFor(key)?.name ?? key
  const placeLabel = (label: ReactNode, cells: ReactNode[]) =>
    mirrored ? [cells[0], label, cells[1]] : [label, ...cells]

  const hasLeader = tally.some((score) => score && score.of > 0)
  const poolsToCompare = pools.filter((pool) => pool?.length).length
  const headToHeadNote =
    shared.length > 0
      ? `Win rate, KDA and games on each Shared Hero. Under ${MIN_GAMES} games is dimmed and can't lead, since that's too few to mean much.${
          hasLeader ? '' : ` None has a Leader yet: that takes two Players with ${MIN_GAMES} or more games on it.`
        }`
      : poolsToCompare >= 2
        ? 'These Players have no heroes in common.'
        : 'Head to head needs two Players with games to compare.'

  return (
    <>
      <p className="section-note">
        Who plays what, most played first. A ring marks a Shared Hero, one at least two Players have played. Pick any
        hero to see its stats.
      </p>
      <div role="row" className="row">
        {placeLabel(
          <div key="label" role="rowheader" className="label">
            Hero Pool
          </div>,
          pools.map((pool, slot) => (
            <div key={slot} role="cell" className="pool-cell">
              <PoolCell
                pool={pool}
                status={statuses[slot]}
                heroFor={heroFor}
                nameOf={nameOf}
                onHeroSelect={onHeroSelect}
              />
            </div>
          )),
        )}
      </div>

      <p className="section-note">{headToHeadNote}</p>
      {hasLeader && (
        <div role="row" className="row">
          {placeLabel(
            <div key="label" role="rowheader" className="label">
              Head to head
            </div>,
            tally.map((score, slot) => (
              <div
                key={slot}
                role="cell"
                className="value tally"
                style={{ '--slot-color': SLOT_COLORS[slot] } as CSSProperties}
              >
                {score ? (
                  <span>
                    Leads on <strong>{score.leads}</strong> of {score.of} shared {score.of === 1 ? 'hero' : 'heroes'}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            )),
          )}
        </div>
      )}
      {shared.map((hero) => (
        // A click on the hero's button bubbles up to here, so the keyboard has a button and the mouse has the whole row.
        <div key={hero.key} role="row" className="row shared-hero" onClick={() => onHeroSelect(hero.key)}>
          {placeLabel(
            <div key="label" role="rowheader" className="label">
              <button type="button" className="shared-hero-name">
                <HeroPortrait hero={heroFor(hero.key)} />
                {nameOf(hero.key)}
              </button>
            </div>,
            hero.results.map((result, slot) => <ResultCell key={slot} hero={hero} result={result} slot={slot} />),
          )}
        </div>
      ))}
    </>
  )
}

type PoolCellProps = {
  pool: PoolHero[] | null
  status: PoolStatus
  heroFor: (key: string) => Hero | undefined
  nameOf: (key: string) => string
  onHeroSelect: (heroKey: string) => void
}

function PoolCell({ pool, status, heroFor, nameOf, onHeroSelect }: PoolCellProps) {
  const [expanded, setExpanded] = useState(false)

  if (status === 'empty') return null
  if (status === 'loading') return <span className="muted">Loading…</span>
  if (status === 'failed') return <span className="muted">Couldn't load this Hero Pool</span>
  if (!pool?.length) return <span className="muted">—</span>

  const extra = pool.length - TOP_HEROES
  return (
    <>
      {(expanded ? pool : pool.slice(0, TOP_HEROES)).map((hero) => {
        const played = formatStat('time_played', hero.timePlayed)
        const name = nameOf(hero.key)
        return (
          <button
            key={hero.key}
            type="button"
            className={`pool-hero${hero.shared ? ' shared' : ''}`}
            style={{ '--share': hero.share } as CSSProperties}
            title={`${name}, ${played} played`}
            aria-label={`${name}, ${played} played${hero.shared ? ', Shared Hero' : ''}`}
            onClick={() => onHeroSelect(hero.key)}
          >
            <HeroPortrait hero={heroFor(hero.key)} />
          </button>
        )
      })}
      {extra > 0 && (
        <button type="button" className="link pool-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `+${extra} more`}
        </button>
      )}
    </>
  )
}

/** A hero's portrait, or a plain box until `/heroes` has loaded (or if it doesn't list the hero). */
function HeroPortrait({ hero }: { hero: Hero | undefined }) {
  return hero ? <img src={hero.portrait} alt="" loading="lazy" /> : <span className="no-portrait" />
}

function ResultCell({ hero, result, slot }: { hero: SharedHero; result: HeroResult | null; slot: number }) {
  const style = { '--slot-color': SLOT_COLORS[slot] } as CSSProperties
  if (!result) {
    return (
      <div role="cell" className="value" style={style}>
        <span className="muted">—</span>
      </div>
    )
  }

  const leads = hero.leaders.includes(slot)
  const winrate = formatStat('win_percentage', result.winrate)
  const kda = formatStat('kda', result.kda)
  const games = `${formatStat('games_played', result.games)} ${result.games === 1 ? 'game' : 'games'}`
  const note = leads ? ', leads' : result.comparable ? '' : ', too few games to compare'
  return (
    <div
      role="cell"
      className={`value hero-result${leads ? ' leader' : ''}${result.comparable ? '' : ' thin'}`}
      style={style}
      aria-label={`${winrate} win rate, ${kda} KDA, ${games}${note}`}
    >
      {leads && (
        <span className="marker" aria-hidden="true">
          ▲
        </span>
      )}
      <span className="hero-numbers">
        <span className="hero-winrate">{winrate}</span>
        <span className="hero-detail">
          <span>{kda} KDA</span> <span className="hero-games">{games}</span>
        </span>
      </span>
    </div>
  )
}
