import type { Chore } from '../../data/chores/client'

const DAY_MS = 86_400_000

export function localDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whole days between two YYYY-MM-DD keys (b - a), immune to DST. */
function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

export type ChoreStatus = {
  /** Days since it was last done; null if never. */
  daysSince: number | null
  /** Days past its due date (positive), or until it is due (negative). Null if never done. */
  daysOverdue: number | null
  state: 'never' | 'overdue' | 'due-today' | 'ok'
}

export function choreStatus(chore: Chore, today: string): ChoreStatus {
  if (!chore.lastDone) return { daysSince: null, daysOverdue: null, state: 'never' }
  const daysSince = daysBetween(chore.lastDone, today)
  const daysOverdue = daysSince - chore.intervalDays
  const state = daysOverdue > 0 ? 'overdue' : daysOverdue === 0 ? 'due-today' : 'ok'
  return { daysSince, daysOverdue, state }
}

export function lastDoneLabel(status: ChoreStatus) {
  if (status.daysSince === null) return 'Never done'
  if (status.daysSince <= 0) return 'Done today'
  if (status.daysSince === 1) return 'Done yesterday'
  return `Done ${status.daysSince} days ago`
}

export function warningLabel(status: ChoreStatus) {
  if (status.state === 'never') return 'Not started'
  if (status.state === 'due-today') return 'Due today'
  if (status.state === 'overdue') {
    const days = status.daysOverdue ?? 0
    return `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`
  }
  return ''
}

const STATE_RANK = { overdue: 0, never: 1, 'due-today': 2, ok: 3 } as const

/** Most overdue first, then never-done, due today, then the rest by how soon they are due. */
export function sortChores(chores: Chore[], today: string): Chore[] {
  return [...chores].sort((a, b) => {
    const sa = choreStatus(a, today)
    const sb = choreStatus(b, today)
    if (sa.state !== sb.state) return STATE_RANK[sa.state] - STATE_RANK[sb.state]
    return (sb.daysOverdue ?? 0) - (sa.daysOverdue ?? 0) || a.name.localeCompare(b.name)
  })
}

export type ChoreCadence = 'daily' | 'weekly' | 'monthly'

export const CADENCE_LABELS: Record<ChoreCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

/** Bucket by interval: every day, up to a fortnight (the twice-weekly vacuum counts), or longer. */
export function choreCadence(chore: Chore): ChoreCadence {
  if (chore.intervalDays <= 1) return 'daily'
  if (chore.intervalDays < 14) return 'weekly'
  return 'monthly'
}

/** Overdue, never done, or due today: what "may need to be addressed". */
export function needsAttention(chore: Chore, today: string) {
  return choreStatus(chore, today).state !== 'ok'
}
