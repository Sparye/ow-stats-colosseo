import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import type { Hero, Role } from '../api/overfast'
import { heroDetailsQuery } from '../api/queries'
import { ALL_HEROES } from '../domain/matchupSearch'

const ROLES: Array<{ role: Role; label: string }> = [
  { role: 'tank', label: 'Tank' },
  { role: 'damage', label: 'Damage' },
  { role: 'support', label: 'Support' },
]

type Props = {
  heroes: Hero[] | undefined
  selected: string
  onSelect: (heroKey: string) => void
}

/** The hero cell's contents: the Hero Scope, and a button that opens the hero popover. */
export function HeroPicker({ heroes, selected, onSelect }: Props) {
  const popover = useRef<HTMLDivElement>(null)
  const current = heroes?.find((h) => h.key === selected)
  // An extra only: until it loads, or if it can't, the Subrole line stays empty.
  const { data: details } = useQuery({ ...heroDetailsQuery(selected), enabled: Boolean(current) })
  const choose = (key: string) => {
    onSelect(key)
    popover.current?.hidePopover()
  }

  return (
    <>
      {current ? (
        <>
          <img className="hero-portrait" src={current.portrait} alt="" />
          <span>
            {current.name}
            <span className="hero-subrole">{details?.subrole}</span>
          </span>
        </>
      ) : (
        <span className="hero-portrait all-heroes">All Heroes</span>
      )}
      <button type="button" className="slot-button hero-change" popoverTarget="hero-picker">
        {current ? 'Change Hero' : 'Select Hero'}
      </button>
      <div id="hero-picker" className="panel hero-picker" popover="auto" ref={popover} aria-label="Choose a hero">
        <button
          type="button"
          className="hero-choice all-heroes"
          aria-pressed={selected === ALL_HEROES}
          onClick={() => choose(ALL_HEROES)}
        >
          All Heroes
        </button>
        {!heroes && <p className="muted">Loading heroes…</p>}
        {heroes &&
          ROLES.map(({ role, label }) => (
            <section key={role}>
              <h2>{label}</h2>
              <div className="hero-grid">
                {heroes
                  .filter((h) => h.role === role)
                  .map((h) => (
                    <button
                      key={h.key}
                      type="button"
                      className="hero-choice"
                      aria-pressed={h.key === selected}
                      onClick={() => choose(h.key)}
                    >
                      <img src={h.portrait} alt="" loading="lazy" />
                      <span>{h.name}</span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
      </div>
    </>
  )
}
