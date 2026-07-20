import type { TodoistTask } from './types'

/**
 * All grouping in the task views is by *local* calendar day. Todoist sends
 * `due.date` as a floating 'YYYY-MM-DD' and `due.datetime` as either floating
 * or zoned ISO, so the two need different handling — see dueDateKey.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toLocalDateKey(new Date())
}

export function addDaysToKey(key: string, days: number): string {
  const date = dateFromKey(key)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

export function tomorrowKey(): string {
  return addDaysToKey(todayKey(), 1)
}

/** Parses 'YYYY-MM-DD' as local midnight — `new Date(key)` would parse it as UTC. */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** The local calendar day a task lands on, or '' when it has no due date. */
export function dueDateKey(task: TodoistTask): string {
  const due = task.due
  if (!due) {
    return ''
  }

  if (due.date) {
    return due.date.slice(0, 10)
  }

  if (due.datetime) {
    const parsed = new Date(due.datetime)
    return Number.isNaN(parsed.getTime()) ? '' : toLocalDateKey(parsed)
  }

  return ''
}

/** 'HH:MM' when the task is due at a specific time, otherwise ''. */
export function dueTimeLabel(task: TodoistTask): string {
  if (!task.due?.datetime) {
    return ''
  }

  const parsed = new Date(task.due.datetime)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function isOverdue(task: TodoistTask, today = todayKey()): boolean {
  const key = dueDateKey(task)
  return Boolean(key) && key < today
}

export function isDueOn(task: TodoistTask, dayKey: string): boolean {
  return dueDateKey(task) === dayKey
}

/** Sort key: earlier due first, undated last. */
export function dueSortValue(task: TodoistTask): number {
  const value = task.due?.datetime ?? task.due?.date
  if (!value) {
    return Number.MAX_SAFE_INTEGER
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

export function formatDayLabel(key: string): string {
  if (!key) {
    return ''
  }

  const today = todayKey()
  if (key === today) return 'Today'
  if (key === addDaysToKey(today, 1)) return 'Tomorrow'
  if (key === addDaysToKey(today, -1)) return 'Yesterday'

  const date = dateFromKey(key)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

/** Days between two keys — negative when `key` is before `from`. */
export function daysBetweenKeys(from: string, key: string): number {
  const ms = dateFromKey(key).getTime() - dateFromKey(from).getTime()
  return Math.round(ms / 86_400_000)
}
