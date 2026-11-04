const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/** A Player's Profile Changed time as relative text, always rounded down: "Profile changed 3 min ago". */
export function profileChangedAgo(changedAt: Date, now: Date): string {
  const seconds = (now.getTime() - changedAt.getTime()) / 1000
  if (seconds < MINUTE) return 'Profile changed just now'
  if (seconds < HOUR) return `Profile changed ${Math.floor(seconds / MINUTE)} min ago`
  if (seconds < DAY) return `Profile changed ${Math.floor(seconds / HOUR)} hr ago`
  if (seconds < MONTH) {
    const days = Math.floor(seconds / DAY)
    return `Profile changed ${days} ${days === 1 ? 'day' : 'days'} ago`
  }
  if (seconds < YEAR) return `Profile changed ${Math.floor(seconds / MONTH)} mo ago`
  return `Profile changed ${Math.floor(seconds / YEAR)} yr ago`
}
