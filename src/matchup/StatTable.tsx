import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Comparison, StatRow } from '../domain/comparison'
import { SLOT_COLORS } from '../domain/slotColors'
import { formatStat } from './format'

type Props = {
  comparison: Comparison
  /** One header per Slot. */
  headers: ReactNode[]
  /** What goes in the hero cell: the Hero Scope and the hero picker. */
  heroPicker: ReactNode
  heroName: string
}

/**
 * Two Players: values either side of the stat label. Three or more: the label
 * column on the left (pinned when scrolling sideways) and one column per Slot.
 *
 * The header row sits in its own band so it can stick to the top of the page;
 * it can't stick from inside the sideways-scrolling Stat Rows, so it scrolls
 * sideways in step with them instead.
 */
export function StatTable({ comparison, headers, heroPicker, heroName }: Props) {
  const slotCount = headers.length
  const mirrored = slotCount === 2
  const tableClass = `stat-table ${mirrored ? 'mirrored' : 'columns'}`
  const band = useRef<HTMLDivElement>(null)
  const headerScroller = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const hidden = useHiddenSides(scroller)
  useScrollInStep(headerScroller, scroller)
  const stuck = useRowsUnder(band, scroller)

  const heroCell = (
    <div key="hero" className="hero-cell" role="columnheader" aria-label="Stat">
      {heroPicker}
    </div>
  )
  const frameProps = {
    className: 'table-frame',
    'data-hidden-left': hidden.left || undefined,
    'data-hidden-right': hidden.right || undefined,
  }

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
    <div
      role="table"
      aria-label={`${heroName} stats`}
      className="table-area"
      data-slots={slotCount}
      style={{ '--slots': slotCount } as CSSProperties}
    >
      <div className="header-band" ref={band} data-stuck={stuck || undefined}>
        <div {...frameProps}>
          <div className="table-scroll header-scroll" ref={headerScroller}>
            <div className={tableClass}>
              <div role="row" className="row header-row">
                {mirrored ? [headers[0], heroCell, headers[1]] : [heroCell, ...headers]}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div {...frameProps}>
        <div className="table-scroll" ref={scroller}>
          <div className={tableClass}>
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

/**
 * Scrolls the header row sideways along with the Stat Rows, either way round,
 * and keeps it exactly as wide as them so the columns line up.
 */
function useScrollInStep(header: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const head = header.current
    const rows = body.current
    if (!head || !rows) return
    const follow = (from: HTMLElement, to: HTMLElement) => () => {
      if (to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft
    }
    const fromRows = follow(rows, head)
    const fromHead = follow(head, rows)
    rows.addEventListener('scroll', fromRows, { passive: true })
    head.addEventListener('scroll', fromHead, { passive: true })

    // Long values can make the Stat Rows wider than the header row's own columns would be.
    const rowsTable = rows.firstElementChild as HTMLElement | null
    const headTable = head.firstElementChild as HTMLElement | null
    const matchWidth = () => {
      if (rowsTable && headTable) headTable.style.width = `${rowsTable.getBoundingClientRect().width}px`
      fromRows()
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(matchWidth)
    if (rowsTable) observer?.observe(rowsTable)
    return () => {
      rows.removeEventListener('scroll', fromRows)
      head.removeEventListener('scroll', fromHead)
      observer?.disconnect()
    }
  }, [header, body])
}

/** Whether Stat Rows have scrolled up under the stuck header band. */
function useRowsUnder(band: RefObject<HTMLElement | null>, rows: RefObject<HTMLElement | null>) {
  const [under, setUnder] = useState(false)

  useEffect(() => {
    const update = () => {
      if (!band.current || !rows.current) return
      // Unstuck, the rows start right where the band ends.
      setUnder(rows.current.getBoundingClientRect().top < band.current.getBoundingClientRect().bottom - 1)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [band, rows])

  return under
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
