/**
 * Pure helpers behind the Garmin cards.
 *
 * Split out from `GarminCards.tsx` so that file exports nothing but components
 * (fast refresh requires it), and so the date and summarising logic — the part
 * that decides which day a number is attributed to — can be tested directly.
 */
import type { GarminWellnessRecord } from '../../data/sheets/types'

/** One metric to surface, and where to read it from a wellness row. */
export type Metric = {
  key: keyof GarminWellnessRecord
  label: string
  unit?: string
  /** Higher is better — drives the trend arrow's colour. */
  higherIsBetter?: boolean
  /**
   * What the number actually means, shown on hover and focus. These are
   * charted daily and the labels are terse, so without this "Intensity
   * minutes" or a bare HRV figure is a number with no interpretation.
   */
  description?: string
}

export function toNumber(value: string): number | null {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatValue(value: number) {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  return value.toFixed(1)
}

/** ISO week start (Monday) for a date key. */
export function weekStartKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

export function formatDayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Whole days between two date keys. UTC, so a DST change cannot shift the count. */
export function daysBetween(from: string, to: string) {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return y && m && d ? Date.UTC(y, m - 1, d) : NaN
  }

  const a = parse(from)
  const b = parse(to)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0

  return Math.round((b - a) / 86_400_000)
}

/**
 * The newest day in `dates` that is not after `wanted`.
 *
 * Typing a date the watch has no reading for should land on the closest day
 * that does, rather than on an empty grid.
 */
export function resolveDate(dates: string[], wanted: string) {
  if (!wanted) return dates[0] ?? ''
  return dates.find((date) => date <= wanted) ?? dates[dates.length - 1] ?? ''
}

export type MetricSummary = {
  latest: { date: string; value: number }
  average: number | null
  trend: 'up' | 'down' | 'flat'
  good: boolean | null
  /** The day being shown has no reading; this value is carried from an older one. */
  carried: boolean
}

/**
 * The value for the day being shown, plus how it compares with the average of
 * the prior fortnight. A single day is noise, so the comparison is against a
 * window rather than yesterday.
 *
 * `rows[0]` is the day being shown. A metric with no reading that day falls
 * back to the most recent older one — Garmin fills VO2 max and endurance score
 * in only every few days — but the fallback is flagged so the card can name the
 * day it actually came from instead of passing it off as the selected day's.
 */
export function summarise(rows: GarminWellnessRecord[], metric: Metric): MetricSummary | null {
  const anchor = rows[0]?.date ?? ''

  const values = rows
    .map((row) => ({ date: row.date, value: toNumber(String(row[metric.key])) }))
    .filter((entry): entry is { date: string; value: number } => entry.value !== null)

  if (values.length === 0) {
    return null
  }

  const latest = values[0]
  const baseline = values.slice(1, 15)
  const average =
    baseline.length > 0 ? baseline.reduce((sum, entry) => sum + entry.value, 0) / baseline.length : null

  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (average !== null && average !== 0) {
    const delta = (latest.value - average) / Math.abs(average)
    if (delta > 0.03) trend = 'up'
    else if (delta < -0.03) trend = 'down'
  }

  const good = trend === 'flat' ? null : (trend === 'up') === (metric.higherIsBetter ?? true)

  return { latest, average, trend, good, carried: Boolean(anchor) && latest.date !== anchor }
}

/**
 * Collapse rows into one averaged row per ISO week, so the same metric grid can
 * render a week without knowing anything about averaging.
 */
export function toWeeklyAverages(rows: GarminWellnessRecord[]): GarminWellnessRecord[] {
  const byWeek = new Map<string, GarminWellnessRecord[]>()

  for (const row of rows) {
    if (!row.date) continue
    const key = weekStartKey(row.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), row])
  }

  const numericKeys = (Object.keys(rows[0] ?? {}) as (keyof GarminWellnessRecord)[]).filter(
    (key) => key !== 'date' && key !== 'training_status',
  )

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekKey, weekRows]) => {
      const averaged = { date: weekKey, training_status: '' } as GarminWellnessRecord

      for (const key of numericKeys) {
        const values = weekRows
          .map((row) => toNumber(String(row[key])))
          .filter((value): value is number => value !== null)

        averaged[key] = values.length
          ? String(values.reduce((sum, value) => sum + value, 0) / values.length)
          : ''
      }

      return averaged
    })
}
