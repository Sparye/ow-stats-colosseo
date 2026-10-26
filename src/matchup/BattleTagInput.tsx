import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { parseBattleTag } from '../domain/battleTag'

type Props = {
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  /** Called with the BattleTag of a picked suggestion, which goes straight into the Slot. */
  onPick: (battleTag: string) => void
  placeholder: string
  invalid: boolean
  /** Recent Players this Slot could take, as player ids. */
  suggestions: string[]
}

/**
 * The BattleTag input, with Recent Players in a dropdown that opens when the input gets the cursor.
 * The list is a popover so it sits above the table's sticky cells and outside its scroll area.
 */
export function BattleTagInput({ id, inputRef, value, onChange, onPick, placeholder, invalid, suggestions }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()

  const query = value.trim().toLowerCase()
  const matches = suggestions.flatMap((playerId) => {
    const parsed = parseBattleTag(playerId)
    if (!parsed.ok) return []
    const { tag } = parsed
    return tag.display.toLowerCase().includes(query) || tag.id.toLowerCase().includes(query) ? [tag] : []
  })
  const expanded = open && matches.length > 0
  const current = active < matches.length ? active : -1
  const optionId = (index: number) => `${listId}-${index}`

  const pick = (battleTag: string) => {
    setOpen(false)
    onPick(battleTag)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(expanded ? Math.min(current + 1, matches.length - 1) : 0)
      setOpen(true)
    } else if (event.key === 'ArrowUp' && expanded) {
      event.preventDefault()
      setActive(Math.max(current - 1, -1))
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'Enter') {
      // With no highlighted suggestion, Enter submits the form as usual.
      if (expanded && current >= 0) {
        event.preventDefault()
        pick(matches[current].display)
      }
      setOpen(false)
    }
  }

  // Popovers are positioned against the window, so follow the input as the page or the table scrolls.
  useLayoutEffect(() => {
    const popover = list.current
    const anchor = inputRef.current
    if (!expanded || !popover || !anchor) return
    popover.showPopover?.()
    const place = () => {
      const box = anchor.getBoundingClientRect()
      popover.style.top = `${box.bottom + 4}px`
      popover.style.left = `${box.left}px`
      popover.style.minWidth = `${box.width}px`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [expanded, inputRef])

  useLayoutEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' })
  })

  return (
    <>
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded && current >= 0 ? optionId(current) : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActive(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid}
      />
      {expanded && (
        <ul ref={list} id={listId} role="listbox" aria-label="Recent Players" className="suggestions" popover="manual">
          {matches.map((tag, index) => (
            <li
              key={tag.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === current}
              // Keeps the cursor in the input, so the list doesn't close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(tag.display)}
            >
              {tag.name}
              <span className="discriminator">#{tag.discriminator}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
