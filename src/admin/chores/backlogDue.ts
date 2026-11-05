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

/** Join the optional date and time inputs into the stored form. A time without a date is dropped. */
export function joinDue(date: string, time: string) {
  if (!date) return ''
  return time ? `${date}T${time}` : date
}
