/** 11:00 PM, 19 November 2022, in the viewer's local time. */
export const TOGETHER_SINCE = new Date(2022, 10, 19, 23, 0, 0)

export type ElapsedParts = {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/** A local date's wall-clock fields as one number, so DST shifts never move the count. */
function wallMs(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds())
}

/** The start's wall-clock time, moved forward `months` months, clamped to the month's length. */
function anniversaryMs(start: Date, months: number) {
  const first = new Date(Date.UTC(start.getFullYear(), start.getMonth() + months, 1))
  const year = first.getUTCFullYear()
  const month = first.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Date.UTC(year, month, Math.min(start.getDate(), lastDay), start.getHours(), start.getMinutes(), start.getSeconds())
}

/**
 * Calendar-accurate time from `start` to `now`, counted the way a person would
 * say it: 3 years, 10 months, 29 days, not a flat count of days.
 *
 * Whole months come first, anchored on the start's day of the month (clamped
 * to the month's length), so Jan 31 plus one month is Feb 28 or 29. What is
 * left over is split into days, hours, minutes and seconds. Wall-clock fields
 * are used throughout, so a daylight-saving change does not shift the count.
 */
export function elapsedSince(start: Date, now: Date): ElapsedParts {
  const nowMs = wallMs(now)

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  while (months > 0 && anniversaryMs(start, months) > nowMs) months -= 1

  let remainder = nowMs - anniversaryMs(start, months)
  const days = Math.floor(remainder / DAY_MS)
  remainder -= days * DAY_MS
  const hours = Math.floor(remainder / HOUR_MS)
  remainder -= hours * HOUR_MS
  const minutes = Math.floor(remainder / MINUTE_MS)
  remainder -= minutes * MINUTE_MS

  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days,
    hours,
    minutes,
    seconds: Math.floor(remainder / 1000),
  }
}

/**
 * The number of months if `now` is a monthiversary, rounded to the whole day:
 * within half a day of a monthly anniversary of `start`. Otherwise null.
 */
export function monthiversaryOn(start: Date, now: Date): number | null {
  const nowMs = wallMs(now)
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  for (const candidate of [months, months + 1]) {
    if (candidate >= 1 && Math.abs(nowMs - anniversaryMs(start, candidate)) <= DAY_MS / 2) {
      return candidate
    }
  }
  return null
}
