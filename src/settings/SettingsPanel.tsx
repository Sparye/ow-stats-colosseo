import { useId } from 'react'
import { DEFAULT_TEAM_ORDER, TEAMS, type TeamCode } from '../domain/teamOrder'
import { textOn } from '../matchup/format'
import { useTeamOrder } from './teamOrder'

const ALL_TEAMS = Object.values(TEAMS).sort((a, b) => a.name.localeCompare(b.name))

export function SettingsButton() {
  return (
    <>
      <button type="button" className="icon-button" popoverTarget="settings" aria-label="Settings">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
            transform="translate(-1 0)"
          />
        </svg>
      </button>
      <div id="settings" className="panel settings" popover="auto" aria-label="Settings">
        <SettingsPanel />
      </div>
    </>
  )
}

function SettingsPanel() {
  const [order, setOrder] = useTeamOrder()
  const baseId = useId()
  const change = (slot: number, code: TeamCode) => setOrder(order.map((c, i) => (i === slot ? code : c)))

  return (
    <>
      <h2>Team colors</h2>
      <p className="muted">Each Slot takes its team's color. Saved in this browser only.</p>
      <ol className="team-order">
        {order.map((code, slot) => (
          <li key={slot}>
            <label htmlFor={`${baseId}-${slot}`}>Slot {slot + 1}</label>
            <span className="swatch" style={{ background: TEAMS[code].color, color: textOn(TEAMS[code].color) }}>
              {code}
            </span>
            <select id={`${baseId}-${slot}`} value={code} onChange={(e) => change(slot, e.target.value as TeamCode)}>
              {ALL_TEAMS.map((team) => (
                <option key={team.code} value={team.code} disabled={team.code !== code && order.includes(team.code)}>
                  {team.name} ({team.code})
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>
      <button type="button" className="secondary" onClick={() => setOrder(DEFAULT_TEAM_ORDER)}>
        Reset to default
      </button>
    </>
  )
}
