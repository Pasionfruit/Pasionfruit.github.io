import type { CalendarEventRecord } from '../data/sheets/repositories'

/** Longest run of days one event is spread over; guards against a bad feed. */
const MAX_SPAN_DAYS = 366

export function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null
}

function daysFrom(start: { y: number; m: number; d: number }, count: number) {
  return Array.from({ length: count }, (_, i) => dayKey(new Date(start.y, start.m - 1, start.d + i)))
}

/**
 * Every calendar day an event covers, as local YYYY-MM-DD keys.
 *
 * All-day events carry plain dates, and the end date is exclusive (a one-day
 * event ends the next day), so a Nov 8-10 event arrives as 11-08 to 11-11 and
 * covers three days. Reading the date text directly, never through `new Date`,
 * keeps it on the right day in any time zone. Timed events cover each day
 * between their start and end, except when they end exactly at midnight.
 */
export function eventDayKeys(event: CalendarEventRecord): string[] {
  if (event.allDay) {
    const start = parseDateOnly(event.start)
    if (!start) return []
    const end = parseDateOnly(event.end)
    const span = end
      ? Math.round((Date.UTC(end.y, end.m - 1, end.d) - Date.UTC(start.y, start.m - 1, start.d)) / 86_400_000)
      : 1
    return daysFrom(start, Math.min(Math.max(span, 1), MAX_SPAN_DAYS))
  }

  const start = new Date(event.start)
  if (Number.isNaN(start.getTime())) return []
  const end = new Date(event.end)
  const first = { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() }
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return [dayKey(start)]

  const last = new Date(end.getTime() - 1)
  const span =
    Math.round(
      (Date.UTC(last.getFullYear(), last.getMonth(), last.getDate()) - Date.UTC(first.y, first.m - 1, first.d)) /
        86_400_000,
    ) + 1
  return daysFrom(first, Math.min(Math.max(span, 1), MAX_SPAN_DAYS))
}

/** "All day", "All day · day 2 of 3", a start time, or "Continued" on a later day of a long timed event. */
export function eventTimeLabelForDay(event: CalendarEventRecord, key: string) {
  const keys = eventDayKeys(event)
  const index = keys.indexOf(key)

  if (event.allDay) {
    return keys.length > 1 && index >= 0 ? `All day · day ${index + 1} of ${keys.length}` : 'All day'
  }

  if (index > 0) return 'Continued'

  const parsed = new Date(event.start)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
