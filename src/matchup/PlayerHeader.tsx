import { useId, useState, type CSSProperties, type FormEvent } from 'react'
import type { Hero } from '../api/overfast'
import { parseBattleTag } from '../domain/battleTag'
import type { Score } from '../domain/comparison'
import type { Gamemode, Platform } from '../domain/matchupSearch'
import type { Team } from '../domain/teamOrder'
import { rankFor, rankLabel, textOn } from './format'
import type { SlotState } from './useSlots'

const GAMEMODE_LABELS: Record<Gamemode, string> = { competitive: 'Competitive', quickplay: 'Quick Play' }
const PLATFORM_LABELS: Record<Platform, string> = { pc: 'PC', console: 'Console' }

function TeamBar({ team, onRemove, removeLabel }: { team: Team; onRemove?: () => void; removeLabel: string }) {
  return (
    <div className="team-bar" style={{ background: team.color, color: textOn(team.color) }}>
      <span title={team.name}>{team.code}</span>
      {onRemove && (
        <button type="button" className="remove" onClick={onRemove} aria-label={removeLabel}>
          ×
        </button>
      )}
    </div>
  )
}

type Props = {
  slot: SlotState
  team: Team
  score: Score | null
  hero: Hero | undefined
  heroName: string
  gamemode: Gamemode
  platform: Platform
  onRemove?: () => void
}

export function PlayerHeader({ slot, team, score, hero, heroName, gamemode, platform, onRemove }: Props) {
  const parsed = parseBattleTag(slot.playerId)
  const display = parsed.ok ? parsed.tag.display : slot.playerId
  const summary = 'summary' in slot ? slot.summary : null
  const rank = summary && rankFor(summary, platform, hero)

  return (
    <div className="player-header" role="columnheader" aria-label={display} style={{ '--team': team.color } as CSSProperties}>
      <TeamBar team={team} onRemove={onRemove} removeLabel={`Remove ${display}`} />
      <div className="identity">
        {summary?.avatar ? <img className="avatar" src={summary.avatar} alt="" /> : <div className="avatar" />}
        <div>
          <div className="battletag">
            {parsed.ok ? (
              <>
                {parsed.tag.name}
                <wbr />
                <span className="discriminator">#{parsed.tag.discriminator}</span>
              </>
            ) : (
              display
            )}
          </div>
          {rank && (
            <div className="rank">
              <img src={rank.rank_icon} alt="" />
              {rankLabel(rank)}
            </div>
          )}
        </div>
      </div>
      <div className="status">
        {slot.status === 'ready' && score && (
          <span className="score">
            Leads <strong>{score.leads}</strong> of {score.of}
          </span>
        )}
        {slot.status === 'loading' && <span className="muted">Loading…</span>}
        {slot.status === 'not-found' && <span className="message">Player not found (BattleTags are case-sensitive)</span>}
        {slot.status === 'private' && <span className="message">This profile is private</span>}
        {slot.status === 'no-games' && (
          <span className="message">
            No {heroName === 'All Heroes' ? '' : `${heroName} `}games in {GAMEMODE_LABELS[gamemode]} on{' '}
            {PLATFORM_LABELS[platform]}
          </span>
        )}
        {slot.status === 'error' && (
          <span className="message">
            Couldn't load stats{' '}
            <button type="button" className="link" onClick={slot.retry}>
              Retry
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

type EmptyProps = {
  team: Team
  /** Returns an error message, or null when the Player was added. */
  onAdd: (battleTag: string) => string | null
  onRemove?: () => void
}

export function EmptySlotHeader({ team, onAdd, onRemove }: EmptyProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = onAdd(value)
    setError(problem)
    if (!problem) setValue('')
  }

  return (
    <div className="player-header empty" role="columnheader" aria-label="Empty slot" style={{ '--team': team.color } as CSSProperties}>
      <TeamBar team={team} onRemove={onRemove} removeLabel="Remove empty slot" />
      <form className="add-form" onSubmit={submit}>
        <label htmlFor={inputId}>BattleTag</label>
        <div className="add-row">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Name#1234"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
          />
          <button type="submit">Add</button>
        </div>
        {error && (
          <p className="message" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
