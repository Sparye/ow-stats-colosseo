import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Hero } from '../api/overfast'
import type { Comparison, StatRow } from '../domain/comparison'
import { SLOT_COLORS } from '../domain/slotColors'
import { formatStat } from './format'

type Props = {
  comparison: Comparison
  /** One header per Slot. */
  headers: ReactNode[]
  hero: Hero | undefined
  heroName: string
}

/**
 * Two Players: values either side of the stat label. Three or more: the label
 * column on the left (pinned when scrolling sideways) and one column per Slot.
 */
export function StatTable({ comparison, headers, hero, heroName }: Props) {
  const slotCount = headers.length
  const mirrored = slotCount === 2
  const scroller = useRef<HTMLDivElement>(null)
  const hidden = useHiddenSides(scroller)

  const heroCell = (
    <div key="hero" className="hero-cell" role="columnheader" aria-label="Stat">
      {hero && <img src={hero.portrait} alt="" />}
      <span>{heroName}</span>
    </div>
  )

  const renderRow = (row: StatRow) => {
    const values = row.values.map((value, slot) => {
      const leads = row.leaders.includes(slot)
      return (
        <div
          key={slot}
          role="cell"
          className={`value${leads ? ' leader' : ''}`}
          style={{ '--slot-color': SLOT_COLORS[slot] } as CSSProperties}
          aria-label={leads ? `${value === null ? '—' : formatStat(row.key, value)}, leads` : undefined}
        >
          {leads && (
            <span className="marker" aria-hidden="true">
              ▲
            </span>
          )}
          {value === null ? <span className="muted">—</span> : formatStat(row.key, value)}
        </div>
      )
    })
    const label = (
      <div key="label" role="rowheader" className="label">
        {row.label}
      </div>
    )
    return (
      <div key={row.key} role="row" className="row">
        {mirrored ? [values[0], label, values[1]] : [label, ...values]}
      </div>
    )
  }

  const rows = (list: StatRow[]) => list.map(renderRow)

  return (
    <div className="table-area" data-slots={slotCount} style={{ '--slots': slotCount } as CSSProperties}>
      <div
        className="table-frame"
        data-hidden-left={hidden.left || undefined}
        data-hidden-right={hidden.right || undefined}
      >
        <div className="table-scroll" ref={scroller}>
          <div role="table" aria-label={`${heroName} stats`} className={`stat-table ${mirrored ? 'mirrored' : 'columns'}`}>
            <div role="row" className="row header-row">
              {mirrored ? [headers[0], heroCell, headers[1]] : [heroCell, ...headers]}
            </div>

            <div role="rowgroup" className="section sample" aria-label="Sample Size">
              {rows(comparison.sample)}
            </div>

            <Section title="Fair Stats" note="Averages and rates, so playtime doesn't decide them" rows={rows(comparison.fair)} open />
            <Section title="Volume Stats" note="Totals that grow with playtime" rows={rows(comparison.volume)} />
            <Section title="Best Stats" note="Single-game and single-life records" rows={rows(comparison.best)} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Which sides of a sideways-scrolling element have content scrolled out of view. */
function useHiddenSides(ref: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 1
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setHidden((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // Both the window and the table's own width (Slots added or removed) change what fits.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    if (el.firstElementChild) observer?.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [ref])

  return hidden
}

function Section({ title, note, rows, open }: { title: string; note: string; rows: ReactNode[]; open?: boolean }) {
  if (rows.length === 0) return null
  if (open) {
    return (
      <div role="rowgroup" className="section" aria-label={title}>
        <h2 className="section-title">
          {title} <span>{note}</span>
        </h2>
        {rows}
      </div>
    )
  }
  return (
    <details className="section">
      <summary className="section-title">
        {title} <span>{note}</span>
      </summary>
      <div role="rowgroup" aria-label={title}>
        {rows}
      </div>
    </details>
  )
}
