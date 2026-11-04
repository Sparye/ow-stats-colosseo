import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { Hero } from '../api/overfast'
import { WIN_RATE, leadCounts, type Comparison, type StatRow } from '../domain/comparison'
import { type StatSection, type TableSection } from '../domain/matchupSearch'
import { SLOT_COLORS } from '../domain/slotColors'
import { formatStat } from './format'
import { HeroesSection } from './HeroesSection'
import type { HeroOverlapState } from './useHeroOverlap'

const SECTIONS: Record<StatSection, { title: string; note: string; shortcut: string }> = {
  fair: { title: 'Fair', note: "Averages and rates, so playtime doesn't decide them", shortcut: 'F' },
  volume: { title: 'Volume', note: 'Totals that grow with playtime', shortcut: 'V' },
  best: { title: 'Best', note: 'Single-game and single-life records', shortcut: 'B' },
}

const HEROES_TAB = { title: 'Heroes', shortcut: 'H' }
const tabFor = (section: TableSection) => (section === 'heroes' ? HEROES_TAB : SECTIONS[section])

type Props = {
  comparison: Comparison
  /** One header per Slot. */
  headers: ReactNode[]
  /** What goes in the hero cell: the Hero Scope and the hero picker. */
  heroPicker: ReactNode
  heroName: string
  /** The sections on offer, one tab each. */
  sections: readonly TableSection[]
  /** Which section shows under the Sample Size. */
  section: TableSection
  onSectionChange: (section: TableSection) => void
  /** What the Heroes section shows. */
  heroOverlap: HeroOverlapState
  heroes: Hero[] | undefined
  /** Sets the Hero Scope, from a hero in the Heroes section. */
  onHeroSelect: (heroKey: string) => void
  /** The Benchmark's column after the Slots, when it's on. */
  benchmark?: {
    header: ReactNode
    /** What the win rate row shows for it. */
    winRate: number | null
    /** Where that win rate comes from, for hovering. */
    winRateNote: string
  }
  /** What goes under each Slot's win rate. */
  winRateNotes?: Array<WinRateNote | null>
}

export type WinRateNote = { text: string; hover: string }

/**
 * Two Players: values either side of the stat label. Three or more: the label
 * column on the left (pinned when scrolling sideways) and one column per Slot.
 *
 * The header row sits in its own band so it can stick to the top of the page;
 * it can't stick from inside the sideways-scrolling Stat Rows, so it scrolls
 * sideways in step with them instead. The section tabs ride in the same band,
 * so switching between Fair, Volume and Best Stats is always one click away.
 */
export function StatTable({
  comparison,
  headers,
  heroPicker,
  heroName,
  sections,
  section,
  onSectionChange,
  heroOverlap,
  heroes,
  onHeroSelect,
  benchmark,
  winRateNotes,
}: Props) {
  const slotCount = headers.length
  const mirrored = slotCount === 2
  const tableClass = `stat-table ${mirrored ? 'mirrored' : 'columns'}${benchmark ? ' has-benchmark' : ''}`
  const band = useRef<HTMLDivElement>(null)
  const headerScroller = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const hidden = useHiddenSides(scroller)
  useScrollInStep(headerScroller, scroller)
  const stuck = useRowsUnder(band, scroller)
  const panelId = useId()

  // Deep in the Stat Rows, start what's next from its top rather than somewhere in its middle.
  const backToTop = () => {
    if (band.current && scroller.current) {
      const under = band.current.getBoundingClientRect().bottom - scroller.current.getBoundingClientRect().top
      if (under > 1) window.scrollBy(0, -under)
    }
  }
  const showSection = (next: TableSection) => {
    backToTop()
    onSectionChange(next)
  }
  useSectionShortcuts(showSection, sections)

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
      const note = row.key === WIN_RATE ? winRateNotes?.[slot] : null
      const shown = value === null ? '—' : formatStat(row.key, value)
      return (
        <div
          key={slot}
          role="cell"
          className={`value${leads ? ' leader' : ''}`}
          style={{ '--slot-color': SLOT_COLORS[slot] } as CSSProperties}
          aria-label={leads ? `${note ? `${shown}, ${note.text}` : shown}, leads` : undefined}
        >
          {leads && (
            <span className="marker" aria-hidden="true">
              ▲
            </span>
          )}
          <span className="value-text">
            {value === null ? <span className="muted">—</span> : shown}
            {note && (
              <span className="win-rate-note" title={note.hover}>
                {note.text}
              </span>
            )}
          </span>
        </div>
      )
    })
    const label = (
      <div key="label" role="rowheader" className="label">
        {row.label}
      </div>
    )
    const benchmarkCell = benchmark && (
      <BenchmarkCell key="benchmark" statKey={row.key} winRate={benchmark.winRate} hover={benchmark.winRateNote} />
    )
    return (
      <div key={row.key} role="row" className="row">
        {mirrored ? [values[0], label, values[1], benchmarkCell] : [label, ...values, benchmarkCell]}
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
      data-benchmark={benchmark ? '' : undefined}
      style={{ '--slots': slotCount } as CSSProperties}
    >
      <div className="header-band" ref={band} data-stuck={stuck || undefined}>
        <div {...frameProps}>
          <div className="table-scroll header-scroll" ref={headerScroller}>
            <div className={tableClass}>
              <div role="row" className="row header-row">
                {mirrored
                  ? [headers[0], heroCell, headers[1], benchmark?.header]
                  : [heroCell, ...headers, benchmark?.header]}
              </div>
            </div>
          </div>
        </div>
        <SectionTabs
          sections={sections}
          section={section}
          onSelect={showSection}
          panelId={panelId}
          leads={(s) =>
            s === 'heroes' ? heroOverlap.tally.map((score) => score?.leads ?? 0) : leadCounts(comparison[s], slotCount)
          }
        />
      </div>

      <div {...frameProps}>
        <div className="table-scroll" ref={scroller}>
          <div className={tableClass}>
            <div role="rowgroup" className="section sample" aria-label="Sample Size">
              {rows(comparison.sample)}
            </div>

            <div
              role="rowgroup"
              id={panelId}
              className="section"
              aria-label={section === 'heroes' ? 'Heroes' : `${SECTIONS[section].title} Stats`}
            >
              {section === 'heroes' ? (
                <HeroesSection
                  overlap={heroOverlap}
                  heroes={heroes}
                  mirrored={mirrored}
                  onHeroSelect={(key) => {
                    backToTop()
                    onHeroSelect(key)
                  }}
                />
              ) : (
                <>
                  <p className="section-note">{SECTIONS[section].note}</p>
                  {rows(comparison[section])}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The Benchmark only has something to show on the win rate row. */
function BenchmarkCell({ statKey, winRate, hover }: { statKey: string; winRate: number | null; hover: string }) {
  const shown = statKey === WIN_RATE && winRate !== null
  return (
    <div role="cell" className="value benchmark" title={shown ? hover : undefined}>
      {shown ? formatStat(statKey, winRate) : '—'}
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

type TabsProps = {
  sections: readonly TableSection[]
  section: TableSection
  onSelect: (section: TableSection) => void
  /** The id of the rowgroup the tabs switch. */
  panelId: string
  /** How many of a section's rows each Slot leads. */
  leads: (section: TableSection) => number[]
}

/**
 * One tab per section, each with a tug-of-war bar of who leads most of its
 * Stat Rows in their Slot Color. Arrow keys move between the tabs.
 */
function SectionTabs({ sections, section, onSelect, panelId, leads }: TabsProps) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = sections.indexOf(section)
    const last = sections.length - 1
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: last }[event.key]
    if (to === undefined) return
    event.preventDefault()
    const index = Math.min(last, Math.max(0, to))
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus()
    onSelect(sections[index])
  }

  return (
    <div className="section-tabs" role="tablist" aria-label="Stats" onKeyDown={onKeyDown}>
      {sections.map((s) => {
        const { title, shortcut } = tabFor(s)
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === section}
            aria-controls={panelId}
            aria-keyshortcuts={shortcut}
            tabIndex={s === section ? 0 : -1}
            onClick={() => onSelect(s)}
          >
            <span className="tab-title">
              {title} {s !== 'heroes' && <span className="tab-suffix">Stats</span>}
              <kbd aria-hidden="true">{shortcut}</kbd>
            </span>
            <LeadBar counts={leads(s)} />
          </button>
        )
      })}
    </div>
  )
}

function LeadBar({ counts }: { counts: number[] }) {
  return (
    <span className="lead-bar" aria-hidden="true">
      {counts.map(
        (count, slot) => count > 0 && <span key={slot} style={{ flexGrow: count, background: SLOT_COLORS[slot] }} />,
      )}
    </span>
  )
}

/** F, V, B and H switch sections from anywhere on the page, except while typing or in a popover. */
function useSectionShortcuts(show: (section: TableSection) => void, sections: readonly TableSection[]) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('input, textarea, select, [contenteditable], [popover]')) return
    const key = event.key.toUpperCase()
    const section = sections.find((s) => tabFor(s).shortcut === key)
    if (section) show(section)
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
