import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { heroesQuery } from '../api/queries'
import { isSamePlayer, parseBattleTag } from '../domain/battleTag'
import { buildComparison } from '../domain/comparison'
import { MAX_PLAYERS, type MatchupSearch } from '../domain/matchupSearch'
import { SLOT_COLORS } from '../domain/slotColors'
import { HeroPicker } from './HeroPicker'
import { EmptySlotHeader, PlayerHeader } from './PlayerHeader'
import { StatTable } from './StatTable'
import { Toggle } from './Toggle'
import { useRecentPlayers } from './useRecentPlayers'
import { useSlots } from './useSlots'

export function MatchupPage() {
  const search = useSearch({ from: '__root__' })
  const navigate = useNavigate()
  // Every control sits in the sticky band, so changing one keeps your place in the Stat Rows.
  const setSearch = (patch: Partial<MatchupSearch>) =>
    void navigate({ to: '/', search: { ...search, ...patch }, resetScroll: false })

  const { data: heroes } = useQuery(heroesQuery())
  const hero = heroes?.find((h) => h.key === search.hero)
  const heroName = hero?.name ?? 'All Heroes'

  const controlsBar = useRef<HTMLDivElement>(null)
  const controlsHeight = useHeight(controlsBar)

  const [wantedSlots, setWantedSlots] = useState(2)
  /** The Slot "+ Add player" just made, whose input gets the cursor. */
  const [addedSlot, setAddedSlot] = useState<number | null>(null)
  const slotCount = Math.min(MAX_PLAYERS, Math.max(2, wantedSlots, search.players.length))
  const slots = useSlots(search)
  const recentPlayers = useRecentPlayers(slots)
  /** Recent Players a Slot can take: Players in other Slots would only be turned away. */
  const suggestionsFor = (index: number) =>
    recentPlayers.filter((id) => !search.players.some((p, i) => i !== index && p.toLowerCase() === id.toLowerCase()))
  const comparison = buildComparison(
    Array.from({ length: slotCount }, (_, i) => {
      const slot = slots[i]
      return slot?.status === 'ready' ? slot.heroStats : null
    }),
  )

  /** Adds a Player to an empty Slot, or swaps the Player in a filled one. */
  const placePlayer = (index: number, input: string): string | null => {
    const parsed = parseBattleTag(input)
    if (!parsed.ok) return parsed.error
    const taken = search.players.some((id, i) => {
      const other = parseBattleTag(id)
      return i !== index && other.ok && isSamePlayer(other.tag, parsed.tag)
    })
    if (taken) return 'Already in this Matchup'
    if (search.players[index] === parsed.tag.id) return null
    const players = [...search.players]
    players[Math.min(index, players.length)] = parsed.tag.id
    setSearch({ players })
    return null
  }
  const addSlot = () => {
    setWantedSlots(slotCount + 1)
    setAddedSlot(slotCount)
  }
  const removeSlot = (index: number) => {
    setWantedSlots(Math.max(2, slotCount - 1))
    setAddedSlot(null)
    if (index < search.players.length) setSearch({ players: search.players.filter((_, i) => i !== index) })
  }

  const headers = Array.from({ length: slotCount }, (_, i) => {
    const slot = slots[i]
    const onRemove = slotCount > 2 ? () => removeSlot(i) : undefined
    return slot ? (
      <PlayerHeader
        key={slot.playerId}
        slot={slot}
        color={SLOT_COLORS[i]}
        score={comparison.scores[i]}
        hero={hero}
        heroName={heroName}
        gamemode={search.gamemode}
        platform={search.platform}
        onPlace={(input) => placePlayer(i, input)}
        onRemove={onRemove}
        suggestions={suggestionsFor(i)}
      />
    ) : (
      <EmptySlotHeader
        key={`empty-${i}`}
        color={SLOT_COLORS[i]}
        onPlace={(input) => placePlayer(i, input)}
        onRemove={onRemove}
        autoFocus={i === addedSlot}
        suggestions={suggestionsFor(i)}
      />
    )
  })

  return (
    <div className="page" style={{ '--controls-height': `${controlsHeight}px` } as CSSProperties}>
      <header className="top-bar">
        <div className="brand">
          <h1>Overwatch Stats Colosseo</h1>
          <p>Hero stats, head to head</p>
        </div>
      </header>

      <div className="controls-bar" ref={controlsBar}>
        <div className="controls">
          <Toggle
            label="Gamemode"
            value={search.gamemode}
            options={[
              { value: 'competitive', label: 'Competitive' },
              { value: 'quickplay', label: 'Quick Play' },
            ]}
            onChange={(gamemode) => setSearch({ gamemode })}
          />
          <Toggle
            label="Platform"
            value={search.platform}
            options={[
              { value: 'pc', label: 'PC' },
              { value: 'console', label: 'Console' },
            ]}
            onChange={(platform) => setSearch({ platform })}
          />
          {slotCount < MAX_PLAYERS && (
            <button type="button" className="add-player" onClick={addSlot}>
              + Add player
            </button>
          )}
        </div>
      </div>

      <main>
        <StatTable
          comparison={comparison}
          headers={headers}
          heroPicker={<HeroPicker heroes={heroes} selected={search.hero} onSelect={(key) => setSearch({ hero: key })} />}
          heroName={heroName}
          section={search.stats}
          onSectionChange={(stats) => setSearch({ stats })}
        />
      </main>

      <footer className="footer">
        Not affiliated with or endorsed by Blizzard Entertainment. Data from{' '}
        <a href="https://github.com/TeKrop/overfast-api">OverFast API</a>.
      </footer>
    </div>
  )
}

/** An element's current height, so the header band can stick just below the controls. */
function useHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return height
}
