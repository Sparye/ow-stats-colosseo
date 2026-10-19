import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { heroesQuery } from '../api/queries'
import { isSamePlayer, parseBattleTag } from '../domain/battleTag'
import { buildComparison } from '../domain/comparison'
import { MAX_PLAYERS, type MatchupSearch } from '../domain/matchupSearch'
import { TEAMS } from '../domain/teamOrder'
import { SettingsButton } from '../settings/SettingsPanel'
import { useTeamOrder } from '../settings/teamOrder'
import { HeroPicker } from './HeroPicker'
import { EmptySlotHeader, PlayerHeader } from './PlayerHeader'
import { StatTable } from './StatTable'
import { Toggle } from './Toggle'
import { useSlots } from './useSlots'

export function MatchupPage() {
  const search = useSearch({ from: '__root__' })
  const navigate = useNavigate()
  const setSearch = (patch: Partial<MatchupSearch>) =>
    void navigate({ to: '/', search: { ...search, ...patch } })

  const { data: heroes } = useQuery(heroesQuery())
  const hero = heroes?.find((h) => h.key === search.hero)
  const heroName = hero?.name ?? 'All Heroes'

  const [teamOrder] = useTeamOrder()
  const [wantedSlots, setWantedSlots] = useState(2)
  const slotCount = Math.min(MAX_PLAYERS, Math.max(2, wantedSlots, search.players.length))
  const slots = useSlots(search)
  const comparison = buildComparison(
    Array.from({ length: slotCount }, (_, i) => {
      const slot = slots[i]
      return slot?.status === 'ready' ? slot.heroStats : null
    }),
  )

  const addPlayer = (input: string): string | null => {
    const parsed = parseBattleTag(input)
    if (!parsed.ok) return parsed.error
    const taken = search.players.some((id) => {
      const other = parseBattleTag(id)
      return other.ok && isSamePlayer(other.tag, parsed.tag)
    })
    if (taken) return 'Already in this Matchup'
    setSearch({ players: [...search.players, parsed.tag.id] })
    return null
  }
  const removeSlot = (index: number) => {
    setWantedSlots(Math.max(2, slotCount - 1))
    if (index < search.players.length) setSearch({ players: search.players.filter((_, i) => i !== index) })
  }

  const headers = Array.from({ length: slotCount }, (_, i) => {
    const team = TEAMS[teamOrder[i]]
    const slot = slots[i]
    const canRemove = slotCount > 2 || !!slot
    return slot ? (
      <PlayerHeader
        key={slot.playerId}
        slot={slot}
        team={team}
        score={comparison.scores[i]}
        hero={hero}
        heroName={heroName}
        gamemode={search.gamemode}
        platform={search.platform}
        onRemove={canRemove ? () => removeSlot(i) : undefined}
      />
    ) : (
      <EmptySlotHeader
        key={`empty-${i}`}
        team={team}
        onAdd={addPlayer}
        onRemove={canRemove ? () => removeSlot(i) : undefined}
      />
    )
  })

  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <h1>Overwatch Stats Colosseo</h1>
          <p>Hero stats, head to head</p>
        </div>
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
          <HeroPicker heroes={heroes} selected={search.hero} onSelect={(key) => setSearch({ hero: key })} />
          <SettingsButton />
        </div>
      </header>

      <main>
        <StatTable comparison={comparison} headers={headers} hero={hero} heroName={heroName} />
        {slotCount < MAX_PLAYERS && (
          <button type="button" className="add-player" onClick={() => setWantedSlots(slotCount + 1)}>
            + Add player
          </button>
        )}
      </main>

      <footer className="footer">
        Not affiliated with or endorsed by Blizzard Entertainment. Data from{' '}
        <a href="https://github.com/TeKrop/overfast-api">OverFast API</a>.
      </footer>
    </div>
  )
}
