import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import type { Hero } from '../api/overfast'
import { parseBattleTag } from '../domain/battleTag'
import type { Score } from '../domain/comparison'
import type { Gamemode, Platform } from '../domain/matchupSearch'
import { rankFor, rankLabel } from './format'
import type { SlotState } from './useSlots'

const GAMEMODE_LABELS: Record<Gamemode, string> = { competitive: 'Competitive', quickplay: 'Quick Play' }
const PLATFORM_LABELS: Record<Platform, string> = { pc: 'PC', console: 'Console' }

/** Puts a BattleTag into this Slot. Returns an error message, or null on success. */
type PlacePlayer = (battleTag: string) => string | null

type Props = {
  slot: SlotState
  color: string
  score: Score | null
  hero: Hero | undefined
  heroName: string
  gamemode: Gamemode
  platform: Platform
  onPlace: PlacePlayer
  onRemove?: () => void
}

export function PlayerHeader({ slot, color, score, hero, heroName, gamemode, platform, onPlace, onRemove }: Props) {
  const [changing, setChanging] = useState(false)
  const parsed = parseBattleTag(slot.playerId)
  const display = parsed.ok ? parsed.tag.display : slot.playerId
  const summary = 'summary' in slot ? slot.summary : null
  const rank = summary && rankFor(summary, platform, hero)
  // Competitive stats only cover the last season played; Quick Play covers every season.
  const season = gamemode === 'competitive' ? summary?.competitive?.[platform]?.season : null

  if (changing) {
    return (
      <SlotFrame label={display} color={color}>
        <BattleTagForm
          initialValue={display}
          onSubmit={(input) => {
            const error = onPlace(input)
            if (!error) setChanging(false)
            return error
          }}
          onRemove={onRemove}
        />
      </SlotFrame>
    )
  }

  return (
    <SlotFrame label={display} color={color}>
      <div className="identity">
        {summary?.avatar ? <img className="avatar" src={summary.avatar} alt="" /> : <div className="avatar" />}
        <div className="who">
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
          {(rank || season) && (
            <div className="rank">
              {rank && (
                <>
                  <img src={rank.rank_icon} alt="" />
                  {rankLabel(rank)}
                </>
              )}
              {season && <span className="season">Season {season}</span>}
            </div>
          )}
        </div>
        <button
          type="button"
          className="slot-button change"
          onClick={() => setChanging(true)}
          aria-label={`Change ${display}`}
        >
          Change
        </button>
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
    </SlotFrame>
  )
}

type EmptyProps = { color: string; onPlace: PlacePlayer; onRemove?: () => void }

export function EmptySlotHeader({ color, onPlace, onRemove }: EmptyProps) {
  return (
    <SlotFrame label="Empty slot" color={color}>
      <BattleTagForm onSubmit={onPlace} onRemove={onRemove} />
    </SlotFrame>
  )
}

function SlotFrame({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div
      className="player-header"
      role="columnheader"
      aria-label={label}
      style={{ '--slot-color': color } as CSSProperties}
    >
      <div className="slot-strip" />
      {children}
    </div>
  )
}

type FormProps = {
  initialValue?: string
  onSubmit: PlacePlayer
  /** Shown as a Remove link; only passed when the Matchup has more than two Slots. */
  onRemove?: () => void
}

function BattleTagForm({ initialValue = '', onSubmit, onRemove }: FormProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    if (initialValue) input.current?.select()
  }, [initialValue])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = onSubmit(value)
    setError(problem)
    if (!problem) setValue('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-label">
        <label htmlFor={inputId}>BattleTag</label>
        {onRemove && (
          <button type="button" className="link" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="add-row">
        <input
          id={inputId}
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Name#1234"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
        />
        <button type="submit" className="slot-button">
          Add
        </button>
      </div>
      {error && (
        <p className="message" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
