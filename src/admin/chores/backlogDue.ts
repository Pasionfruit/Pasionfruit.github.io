import type { BacklogItem } from '../../data/backlog/client'

/** The moment an item is due: a date alone means the end of that day. */
function dueMoment(due: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(due)
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  return h === undefined
    ? new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 59)
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
}

export type DueState = 'none' | 'overdue' | 'today' | 'later'

export function dueState(due: string, now: Date): DueState {
  const moment = dueMoment(due)
  if (!moment) return 'none'
  if (moment.getTime() < now.getTime()) return 'overdue'
  return moment.toDateString() === now.toDateString() ? 'today' : 'later'
}

/** "Today", "Tomorrow" or "Nov 8", with the time when one was set, e.g. "Today, 3:00 PM". */
export function formatDue(due: string, now: Date): string {
  const moment = dueMoment(due)
  if (!moment) return ''
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const day =
    moment.toDateString() === now.toDateString()
      ? 'Today'
      : moment.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : moment.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (!due.includes('T')) return day
  const time = moment.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time}`
}

/** Open items first, soonest due first, undated last; finished items sink to the bottom. */
export function sortBacklog(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const am = dueMoment(a.due)?.getTime() ?? Infinity
    const bm = dueMoment(b.due)?.getTime() ?? Infinity
    if (am !== bm) return am < bm ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** Join the day and the optional time into the stored form. A time without a day is dropped. */
export function joinDue(date: string, time: string) {
  if (!date) return ''
  return time ? `${date}T${time}` : date
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** An hour from now, rounded up to the next half hour: 11:25 -> 12:30 PM. */
export function defaultDue(now: Date): { date: string; time: string } {
  const target = new Date(now.getTime() + 60 * 60_000)
  const minutes = target.getMinutes()
  if (minutes === 0 || minutes === 30) target.setSeconds(0, 0)
  else if (minutes < 30) target.setMinutes(30, 0, 0)
  else target.setHours(target.getHours() + 1, 0, 0, 0)
  return { date: dateKey(target), time: `${pad(target.getHours())}:${pad(target.getMinutes())}` }
}

/** The next 30 days as plain labels: Today, Tomorrow, then "Sat, Nov 7". */
export function dayOptions(now: Date, count = 30): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    return { value: dateKey(day), label }
  })
}

/** "All day", then every half hour as "9:00 AM" style labels. */
export function timeOptions(): { value: string; label: string }[] {
  const options = [{ value: '', label: 'All day' }]
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const hour12 = h % 12 === 0 ? 12 : h % 12
    options.push({ value: `${pad(h)}:${pad(m)}`, label: `${hour12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}` })
  }
  return options
}
