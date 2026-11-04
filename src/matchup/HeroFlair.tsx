import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { Ability, Hero, HeroDetails, Hitpoints } from '../api/overfast'

/** The hero cell with the hero's details loaded: who they are, how much they can take, and what they can do. */
export function HeroFlair({ hero, details }: { hero: Hero; details: HeroDetails }) {
  return (
    <div className="hero-flair">
      <img className="hero-portrait" src={hero.portrait} alt="" />
      <div className="hero-facts">
        <span className="hero-name">{hero.name}</span>
        {details.subrole && <span className="hero-subrole">{details.subrole}</span>}
        {details.hitpoints && <HitpointsBar hitpoints={details.hitpoints} />}
      </div>
      <AbilityIcons abilities={details.abilities} />
    </div>
  )
}

const HITPOINT_KINDS = ['health', 'armor', 'shields'] as const

/** One segment per kind of Hitpoints the hero has, as long as its share of the total. */
function HitpointsBar({ hitpoints }: { hitpoints: Hitpoints }) {
  const kinds = HITPOINT_KINDS.filter((kind) => hitpoints[kind] > 0)
  const spoken = kinds.map((kind) => `${hitpoints[kind]} ${kind}`).join(', ')
  return (
    <div className="hitpoints" role="img" aria-label={`Hitpoints: ${spoken}, ${hitpoints.total} total`}>
      {kinds.map((kind) => (
        <span key={kind} className={kind} style={{ flexGrow: hitpoints[kind] }} title={kind}>
          {hitpoints[kind]}
        </span>
      ))}
    </div>
  )
}

/**
 * A row of Ability icons. Each opens its name and description on hover, keyboard
 * focus or a tap. They're popovers so they sit outside the table's scroll area.
 */
function AbilityIcons({ abilities }: { abilities: Ability[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const row = useRef<HTMLUListElement>(null)
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined)
  const id = useId()

  const show = (index: number) => {
    clearTimeout(closing.current)
    setOpen(index)
  }
  const hide = () => {
    clearTimeout(closing.current)
    setOpen(null)
  }
  // Touch has no hover to end. The brief wait lets the mouse cross onto the description.
  const onHover = (index: number) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') show(index)
  }
  const onHoverEnd = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') closing.current = setTimeout(hide, 150)
  }

  useEffect(() => () => clearTimeout(closing.current), [])

  // Popovers are positioned against the window, so follow the icon as the page or the table scrolls.
  useLayoutEffect(() => {
    const anchor = open === null ? null : row.current?.children[open]
    const tip = anchor?.querySelector<HTMLElement>('[popover]')
    if (!anchor || !tip) return
    tip.showPopover?.()
    const place = () => {
      const box = anchor.getBoundingClientRect()
      const below = box.bottom + 6
      const fitsBelow = below + tip.offsetHeight <= window.innerHeight
      tip.style.top = `${fitsBelow ? below : box.top - 6 - tip.offsetHeight}px`
      const centered = box.left + box.width / 2 - tip.offsetWidth / 2
      tip.style.left = `${Math.max(8, Math.min(centered, window.innerWidth - tip.offsetWidth - 8))}px`
    }
    place()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    const closeOnPressElsewhere = (event: Event) => {
      if (!row.current?.contains(event.target as Node)) setOpen(null)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOnPressElsewhere)
    return () => {
      tip.hidePopover?.()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOnPressElsewhere)
    }
  }, [open])

  return (
    <ul className="hero-abilities" aria-label="Abilities" ref={row}>
      {abilities.map((ability, index) => (
        <li key={ability.name}>
          <button
            type="button"
            aria-label={ability.name}
            aria-describedby={`${id}-${index}`}
            onPointerEnter={onHover(index)}
            onPointerLeave={onHoverEnd}
            onFocus={() => show(index)}
            onBlur={hide}
            onClick={() => show(index)}
          >
            <img src={ability.icon} alt="" loading="lazy" />
          </button>
          <div
            className="ability-tip"
            role="tooltip"
            popover="manual"
            onPointerEnter={onHover(index)}
            onPointerLeave={onHoverEnd}
          >
            <strong>{ability.name}</strong>
            <span id={`${id}-${index}`}>{ability.description}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
