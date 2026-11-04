type Props<T extends string> = {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

export function Toggle<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className="toggle" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type SwitchProps = {
  label: string
  on: boolean
  onChange: (on: boolean) => void
  /** Why it can't be used right now, shown on the switch. Also makes it read as off. */
  disabledReason?: string
}

/** A single on/off for something extra in the Matchup. */
export function Switch({ label, on, onChange, disabledReason }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={on && !disabledReason}
      disabled={!!disabledReason}
      onClick={() => onChange(!on)}
    >
      {label}
      {disabledReason && (
        <>
          {' '}
          <span className="switch-reason">{disabledReason}</span>
        </>
      )}
    </button>
  )
}
