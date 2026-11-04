const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`

/** A Player's Last Updated time as relative text, always rounded down: "Updated 3 min ago". */
export function updatedAgo(updatedAt: Date, now: Date): string {
  const seconds = (now.getTime() - updatedAt.getTime()) / 1000
  if (seconds < MINUTE) return 'Updated just now'
  if (seconds < HOUR) return `Updated ${Math.floor(seconds / MINUTE)} min ago`
  if (seconds < DAY) return `Updated ${Math.floor(seconds / HOUR)} hr ago`
  if (seconds < MONTH) return `Updated ${plural(Math.floor(seconds / DAY), 'day')} ago`
  if (seconds < YEAR) return `Updated ${plural(Math.floor(seconds / MONTH), 'month')} ago`
  return `Updated ${plural(Math.floor(seconds / YEAR), 'year')} ago`
}
