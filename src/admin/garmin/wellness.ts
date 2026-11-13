/**
 * Pure helpers behind the Garmin cards.
 *
 * Split out from `GarminCards.tsx` so that file exports nothing but components
 * (fast refresh requires it), and so the date and summarising logic — the part
 * that decides which day a number is attributed to — can be tested directly.
 */
import type { GarminWellnessRecord } from '../../data/sheets/types'

/** One metric to surface, and where to read it from a wellness row. */
export type Metric<Row = GarminWellnessRecord> = {
  key: keyof Row
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
  /** Up to the last fortnight of readings, oldest first, ending with `latest`. For a sparkline. */
  series: number[]
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
export function summarise<Row extends { date: string }>(rows: Row[], metric: Metric<Row>): MetricSummary | null {
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

  const series = values
    .slice(0, 14)
    .map((entry) => entry.value)
    .reverse()

  return { latest, average, trend, good, carried: Boolean(anchor) && latest.date !== anchor, series }
}

/** A one-line read of how the metrics are moving, for the collapsed card. */
export type TrendNote = { tone: 'good' | 'bad' | 'flat' | 'none'; text: string }

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)

/**
 * "Trending well — sleep score ▲ 81, resting HR ▼ 55": how the shown day sits
 * against each metric's own two-week average, boiled down to a headline and the
 * two metrics that moved most. Arrows say which way it moved; whether that is
 * good or bad is what the headline counts.
 */
export function trendNote<Row extends { date: string }>(rows: Row[], metrics: Metric<Row>[]): TrendNote {
  const entries = metrics
    .map((metric) => ({ metric, summary: summarise(rows, metric) }))
    .filter((entry): entry is { metric: Metric<Row>; summary: MetricSummary } => entry.summary !== null)

  if (entries.length === 0) return { tone: 'none', text: 'No readings yet.' }

  const moved = entries
    .filter((entry) => entry.summary.trend !== 'flat' && entry.summary.average)
    .sort(
      (a, b) =>
        Math.abs((b.summary.latest.value - (b.summary.average ?? 0)) / (b.summary.average ?? 1)) -
        Math.abs((a.summary.latest.value - (a.summary.average ?? 0)) / (a.summary.average ?? 1)),
    )

  const better = moved.filter((entry) => entry.summary.good).length
  const worse = moved.filter((entry) => entry.summary.good === false).length

  if (moved.length === 0) {
    const first = entries.slice(0, 2).map((entry) => `${lower(entry.metric.label)} ${formatValue(entry.summary.latest.value)}`)
    return { tone: 'flat', text: `Holding steady — ${first.join(', ')}` }
  }

  const detail = moved
    .slice(0, 2)
    .map(
      (entry) =>
        `${lower(entry.metric.label)} ${entry.summary.trend === 'up' ? '▲' : '▼'} ${formatValue(entry.summary.latest.value)}`,
    )
    .join(', ')

  if (better > worse) return { tone: 'good', text: `Trending well — ${detail}` }
  if (worse > better) return { tone: 'bad', text: `Slipping — ${detail}` }
  return { tone: 'flat', text: `Mixed — ${detail}` }
}

/**
 * Collapse rows into one averaged row per ISO week, so the same metric grid can
 * render a week without knowing anything about averaging.
 */
export function toWeeklyAverages<Row extends { date: string }>(rows: Row[]): Row[] {
  const byWeek = new Map<string, Row[]>()

  for (const row of rows) {
    if (!row.date) continue
    const key = weekStartKey(row.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), row])
  }

  // Text columns (Garmin's training_status) average to '' like any other
  // value with no numbers in it.
  const numericKeys = (Object.keys(rows[0] ?? {}) as (keyof Row)[]).filter((key) => key !== 'date')

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekKey, weekRows]) => {
      const averaged = { date: weekKey } as Row

      for (const key of numericKeys) {
        const values = weekRows
          .map((row) => toNumber(String(row[key])))
          .filter((value): value is number => value !== null)

        averaged[key] = (values.length
          ? String(values.reduce((sum, value) => sum + value, 0) / values.length)
          : '') as Row[keyof Row]
      }

      return averaged
    })
}

// ── Health rating ───────────────────────────────────────────────────────────

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export function gradeOf(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export type HealthScore = { date: string; score: number; grade: Grade }

const clamp = (value: number) => Math.max(0, Math.min(100, value))
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

type HealthPart = {
  key: string
  /** 0–100 for one reading; `baseline` is the average of the prior fortnight, or null without one. */
  score: (value: number, baseline: number | null) => number | null
  /** Only meaningful once the day is over, so left out for today. */
  cumulative?: boolean
}

/*
 * What goes into the rating, each on a 0–100 scale. Sleep is Garmin's own score
 * when there is one, else hours asleep against eight. HRV and resting heart rate
 * are judged against your own recent average, not a textbook number: HRV 10%
 * under it costs 20 points, resting HR 5% over it costs 20. Activity is steps
 * against 10,000 and intensity minutes against the 150-a-week guidance. Stress
 * is the inverse of Garmin's 0–100. The rating is the plain average of whatever
 * is available for the day, and needs at least two.
 */
const HEALTH_PARTS: HealthPart[] = [
  { key: 'sleep_score', score: (value) => clamp(value) },
  { key: 'sleep_duration_h', score: (value) => clamp((value / 8) * 100) },
  { key: 'hrv', score: (value, baseline) => (baseline ? clamp(100 + (value / baseline - 1) * 200) : null) },
  { key: 'resting_hr', score: (value, baseline) => (baseline ? clamp(100 - (value / baseline - 1) * 400) : null) },
  { key: 'steps', score: (value) => clamp((value / 10_000) * 100), cumulative: true },
  { key: 'intensity_minutes', score: (value) => clamp((value / 22) * 100), cumulative: true },
  { key: 'stress_avg', score: (value) => clamp(100 - value) },
  { key: 'body_battery_high', score: (value) => clamp(value) },
]

/**
 * A 0–100 health rating for each day that has enough readings, in the order of
 * `rows` (newest first). `today` is passed in so this stays pure: steps and
 * intensity minutes for a day still in progress would drag it down unfairly.
 */
export function dailyHealthScores<Row extends { date: string }>(rows: Row[], today = ''): HealthScore[] {
  const read = (row: Row, key: string) => toNumber(String((row as unknown as Record<string, unknown>)[key] ?? ''))
  const scores: HealthScore[] = []

  rows.forEach((row, index) => {
    if (!row.date) return

    const baselineOf = (key: string) => {
      const values = rows
        .slice(index + 1, index + 15)
        .map((older) => read(older, key))
        .filter((value): value is number => value !== null)
      return values.length >= 3 ? mean(values) : null
    }

    const hasSleepScore = read(row, 'sleep_score') !== null
    const parts: number[] = []

    for (const part of HEALTH_PARTS) {
      if (part.key === 'sleep_duration_h' && hasSleepScore) continue
      if (part.cumulative && row.date === today) continue

      const value = read(row, part.key)
      if (value === null) continue

      const scored = part.score(value, baselineOf(part.key))
      if (scored !== null) parts.push(scored)
    }

    if (parts.length < 2) return

    const score = Math.round(mean(parts))
    scores.push({ date: row.date, score, grade: gradeOf(score) })
  })

  return scores
}

export type Rating = { score: number; grade: Grade; days: number }

function ratingOf(scores: HealthScore[]): Rating | null {
  if (scores.length === 0) return null
  const score = Math.round(mean(scores.map((entry) => entry.score)))
  return { score, grade: gradeOf(score), days: scores.length }
}

/** The average rating over the `days` days ending on `endDate`; days with no rating are simply absent. */
export function trailingRating(scores: HealthScore[], endDate: string, days: number): Rating | null {
  return ratingOf(
    scores.filter((entry) => {
      const gap = daysBetween(entry.date, endDate)
      return gap >= 0 && gap < days
    }),
  )
}

/** The seven days ending on `endDate`. */
export const weekRating = (scores: HealthScore[], endDate: string) => trailingRating(scores, endDate, 7)

/** The 30 days ending on `endDate`: steadier than a week, and never a half-empty calendar month. */
export const monthRating = (scores: HealthScore[], endDate: string) => trailingRating(scores, endDate, 30)

/** The 90 days ending on `endDate`. */
export const quarterRating = (scores: HealthScore[], endDate: string) => trailingRating(scores, endDate, 90)

/** The date key `days` after `key` (negative for before), in UTC so a DST change cannot shift it. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** The average rating of the calendar week that begins on `weekStart`. */
export function isoWeekRating(scores: HealthScore[], weekStart: string): Rating | null {
  return ratingOf(scores.filter((entry) => weekStartKey(entry.date) === weekStart))
}

export type HealthPoint = { label: string; score: number }

/** The trendline's points, oldest first: the last 30 days, or the last 12 weeks averaged. */
export function healthSeries(scores: HealthScore[], mode: 'day' | 'week'): HealthPoint[] {
  if (mode === 'day') {
    return scores
      .slice(0, 30)
      .map((entry) => ({ label: entry.date, score: entry.score }))
      .reverse()
  }

  const byWeek = new Map<string, number[]>()
  for (const entry of scores) {
    const key = weekStartKey(entry.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), entry.score])
  }

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([label, values]) => ({ label, score: Math.round(mean(values)) }))
    .reverse()
}
