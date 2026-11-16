import type { GarminHealthRecord, GarminWellnessRecord } from '../data/sheets/types'
import { sportOf } from '../admin/training/activities'
import { addDaysToKey, dateFromKey, toLocalDateKey } from '../data/todoist/dates'
import { blankCheckin, isFaceAngle, parseStoredMarks, type Checkin, type ContentItem, type NutritionDay, type SkinPhoto } from './client'

/** The first 90-day period. Tracking carries on past it; the end date is only a reference. */
export const PERIOD_START = '2026-11-16'
export const PERIOD_DAYS = 90
export const PERIOD_END = addDaysToKey(PERIOD_START, PERIOD_DAYS - 1)

export type DateRange = { from: string; to: string }

export function inRange(date: string, range: DateRange): boolean {
  const day = date.slice(0, 10)
  return day >= range.from && day <= range.to
}

/** The last `days` days ending on `end`, inclusive. */
export function lastDays(days: number, end: string): DateRange {
  return { from: addDaysToKey(end, -(days - 1)), to: end }
}

/** A finite number from a text field, or null when it was skipped. */
export function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function mean(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null)
  return real.length ? real.reduce((a, b) => a + b, 0) / real.length : null
}

/** Monday of the week containing the date. */
export function weekStart(date: string): string {
  const day = dateFromKey(date.slice(0, 10)).getDay()
  return addDaysToKey(date.slice(0, 10), -((day + 6) % 7))
}

export function acneTotal(c: Checkin): number | null {
  const face = num(c.acne_face)
  const back = num(c.acne_back)
  if (face === null && back === null) return null
  return (face ?? 0) + (back ?? 0)
}

/** A day number for sorting dates into 0, 1, 2… regardless of DST. */
function dayIndex(date: string): number {
  const d = dateFromKey(date)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

export type Pair = { x: number; y: number }

export type Correlation = {
  id: string
  label: string
  n: number
  r: number | null
  /** Plain-language reading; never claims one thing causes the other. */
  reading: string
}

/** Pearson r, or null with fewer than 3 pairs or no variation. */
export function pearson(pairs: Pair[]): number | null {
  if (pairs.length < 3) return null
  const mx = pairs.reduce((a, p) => a + p.x, 0) / pairs.length
  const my = pairs.reduce((a, p) => a + p.y, 0) / pairs.length
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const p of pairs) {
    sxy += (p.x - mx) * (p.y - my)
    sxx += (p.x - mx) ** 2
    syy += (p.y - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

const MIN_PAIRS = 10

function describe(label: string, r: number | null, n: number, high: string, low: string): string {
  if (r === null || n < MIN_PAIRS) return `Not enough days yet (${n} of ${MIN_PAIRS} needed).`
  const strength = Math.abs(r) < 0.2 ? 'no clear' : Math.abs(r) < 0.4 ? 'a weak' : Math.abs(r) < 0.6 ? 'a moderate' : 'a strong'
  if (strength === 'no clear') return `No clear link between ${label} in these ${n} days.`
  return `${strength[0].toUpperCase()}${strength.slice(1)} pattern: ${r > 0 ? high : low} (r = ${r.toFixed(2)}, ${n} days). This is a pattern in your data, not proof of cause.`
}

/** Days where both values exist, with an optional shift of the second series by `lag` days. */
function pairUp(
  rows: Checkin[],
  x: (c: Checkin) => number | null,
  y: (c: Checkin) => number | null,
  lag = 0,
): Pair[] {
  const byDay = new Map(rows.map((c) => [dayIndex(c.date), c]))
  const pairs: Pair[] = []
  for (const c of rows) {
    const other = byDay.get(dayIndex(c.date) + lag)
    if (!other) continue
    const a = x(c)
    const b = y(other)
    if (a !== null && b !== null) pairs.push({ x: a, y: b })
  }
  return pairs
}

export function correlations(rows: Checkin[]): Correlation[] {
  const defs = [
    { id: 'sugar-acne', label: 'added sugar and next-day acne count', x: (c: Checkin) => num(c.sugar_g), y: acneTotal, lag: 1,
      high: 'more sugar days tended to be followed by more spots', low: 'more sugar days tended to be followed by fewer spots' },
    { id: 'dairy-acne', label: 'dairy/whey and next-day acne count', x: (c: Checkin) => (c.dairy === 'yes' ? 1 : c.dairy === 'no' ? 0 : null), y: acneTotal, lag: 1,
      high: 'dairy days tended to be followed by more spots', low: 'dairy days tended to be followed by fewer spots' },
    { id: 'sleep-energy', label: 'sleep and energy', x: (c: Checkin) => num(c.sleep_h), y: (c: Checkin) => num(c.energy), lag: 0,
      high: 'longer sleep went with higher energy', low: 'longer sleep went with lower energy' },
    { id: 'sleep-mood', label: 'sleep and mood', x: (c: Checkin) => num(c.sleep_h), y: (c: Checkin) => num(c.mood), lag: 0,
      high: 'longer sleep went with better mood', low: 'longer sleep went with worse mood' },
    { id: 'stress-acne', label: 'stress and next-day acne count', x: (c: Checkin) => num(c.stress), y: acneTotal, lag: 1,
      high: 'higher-stress days tended to be followed by more spots', low: 'higher-stress days tended to be followed by fewer spots' },
    { id: 'sleep-stress', label: 'sleep and stress', x: (c: Checkin) => num(c.sleep_h), y: (c: Checkin) => num(c.stress), lag: 0,
      high: 'longer sleep went with higher stress', low: 'longer sleep went with lower stress' },
  ]
  return defs.map((d) => {
    const pairs = pairUp(rows, d.x, d.y, d.lag)
    const r = pearson(pairs)
    return { id: d.id, label: d.label, n: pairs.length, r, reading: describe(d.label, r, pairs.length, d.high, d.low) }
  })
}

// ── Training ────────────────────────────────────────────────────────────────

export type Sport = ReturnType<typeof sportOf>

export function activityKey(a: GarminHealthRecord): string {
  return `${a.date.slice(0, 10)}|${a.activity_id || a.title}`
}

export function minutesOf(a: GarminHealthRecord): number {
  return num(a.duration_min) ?? 0
}

export type WeekVolume = { week: string; minutes: number; miles: number; sessions: number }

export function weeklyVolume(activities: GarminHealthRecord[]): WeekVolume[] {
  const weeks = new Map<string, WeekVolume>()
  for (const a of activities) {
    const week = weekStart(a.date)
    const row = weeks.get(week) ?? { week, minutes: 0, miles: 0, sessions: 0 }
    row.minutes += minutesOf(a)
    row.miles += num(a.distance_mi) ?? 0
    row.sessions += 1
    weeks.set(week, row)
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week))
}

/** Days with at least one session, as a share of the days in the range. */
export function consistency(activities: GarminHealthRecord[], range: DateRange): { activeDays: number; days: number; pct: number } {
  const days = dayIndex(range.to) - dayIndex(range.from) + 1
  const activeDays = new Set(activities.filter((a) => inRange(a.date, range)).map((a) => a.date.slice(0, 10))).size
  return { activeDays, days, pct: days > 0 ? Math.round((activeDays / days) * 100) : 0 }
}

export type RunPoint = { date: string; paceMinPerMile: number; avgHr: number }

/** Runs with a distance, a time and a heart rate: the ones that say something about efficiency. */
export function runPoints(activities: GarminHealthRecord[]): RunPoint[] {
  const points: RunPoint[] = []
  for (const a of activities) {
    if (sportOf(a.activity_type) !== 'run') continue
    const miles = num(a.distance_mi)
    const minutes = num(a.duration_min)
    const hr = num(a.avg_hr)
    if (!miles || !minutes || !hr || miles < 0.5) continue
    points.push({ date: a.date.slice(0, 10), paceMinPerMile: minutes / miles, avgHr: hr })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Average pace per week for runs whose average heart rate sits inside the band. */
export function paceAtHeartRate(points: RunPoint[], low: number, high: number): { week: string; pace: number; runs: number }[] {
  const weeks = new Map<string, number[]>()
  for (const p of points) {
    if (p.avgHr < low || p.avgHr > high) continue
    const week = weekStart(p.date)
    weeks.set(week, [...(weeks.get(week) ?? []), p.paceMinPerMile])
  }
  return [...weeks.entries()]
    .map(([week, paces]) => ({ week, pace: paces.reduce((a, b) => a + b, 0) / paces.length, runs: paces.length }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

export function formatPace(minPerMile: number): string {
  const whole = Math.floor(minPerMile)
  const seconds = Math.round((minPerMile - whole) * 60)
  return seconds === 60 ? `${whole + 1}:00` : `${whole}:${String(seconds).padStart(2, '0')}`
}

/** Garmin/Apple minutes on a day, to pre-fill the check-in's training time. */
export function trainingMinutesOn(activities: GarminHealthRecord[], date: string): number {
  return Math.round(activities.filter((a) => a.date.slice(0, 10) === date).reduce((a, b) => a + minutesOf(b), 0))
}

// ── Content ─────────────────────────────────────────────────────────────────

export function contentHours(item: ContentItem): number {
  return ((num(item.filming_min) ?? 0) + (num(item.editing_min) ?? 0)) / 60
}

export type WeekContent = { week: string; posts: number; hours: number }

export function weeklyContent(items: ContentItem[]): WeekContent[] {
  const weeks = new Map<string, WeekContent>()
  for (const item of items) {
    // Posts count in the week they went out; work hours in that same week for simplicity.
    const date = item.status === 'published' && item.post_date ? item.post_date : item.updated_at.slice(0, 10)
    if (!date) continue
    const week = weekStart(date)
    const row = weeks.get(week) ?? { week, posts: 0, hours: 0 }
    if (item.status === 'published') row.posts += 1
    row.hours += contentHours(item)
    weeks.set(week, row)
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week))
}

/** Likes plus comments per view, as a percentage; null with no views. */
export function engagementRate(items: ContentItem[]): number | null {
  let views = 0
  let reactions = 0
  for (const i of items) {
    views += num(i.views) ?? 0
    reactions += (num(i.likes) ?? 0) + (num(i.comments) ?? 0)
  }
  return views > 0 ? (reactions / views) * 100 : null
}

// ── Windows and summaries ───────────────────────────────────────────────────

/** Average of a check-in field over the last N days ending at `end`. */
export function windowAverage(rows: Checkin[], pick: (c: Checkin) => number | null, days: number, end: string): number | null {
  const range = lastDays(days, end)
  return mean(rows.filter((c) => inRange(c.date, range)).map(pick))
}

export type Windows = { d30: number | null; d60: number | null; d90: number | null }

export function windows(rows: Checkin[], pick: (c: Checkin) => number | null, end: string): Windows {
  return { d30: windowAverage(rows, pick, 30, end), d60: windowAverage(rows, pick, 60, end), d90: windowAverage(rows, pick, 90, end) }
}

export type WeekSummary = {
  week: string
  checkins: number
  acne: number | null
  sleep: number | null
  energy: number | null
  sugar: number | null
  protein: number | null
  skincareDays: number
  masks: number
}

export function weeklySummaries(rows: Checkin[]): WeekSummary[] {
  const weeks = new Map<string, Checkin[]>()
  for (const c of rows) {
    const w = weekStart(c.date)
    weeks.set(w, [...(weeks.get(w) ?? []), c])
  }
  return [...weeks.entries()]
    .map(([week, list]) => ({
      week,
      checkins: list.filter((c) => c.updated_at).length,
      acne: mean(list.map(acneTotal)),
      sleep: mean(list.map((c) => num(c.sleep_h))),
      energy: mean(list.map((c) => num(c.energy))),
      sugar: mean(list.map((c) => num(c.sugar_g))),
      protein: mean(list.map((c) => num(c.protein_g))),
      skincareDays: list.filter((c) => c.am_done === 'yes' && c.pm_done === 'yes').length,
      masks: list.filter((c) => c.mask === 'yes').length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/** Whole days between two keys (b − a). */
export function daysBetween(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a)
}

/** Which day of the 90-day period a date is (1-based), or null before it starts. */
export function periodDay(date: string): number | null {
  const n = daysBetween(PERIOD_START, date) + 1
  return n >= 1 ? n : null
}

export function todayLocal(): string {
  return toLocalDateKey(new Date())
}

// ── Imported sleep and training; routine upkeep ─────────────────────────────

export type ImportedDay = { sleep_h: string; min_training: string; protein_g: string; carbs_g: string; sugar_g: string }

/**
 * Sleep hours (Garmin), training minutes (Garmin plus Hevy/Apple workouts) and
 * Cronometer's protein, carbs and sugar for a day. Added sugar wins over total
 * sugar when Cronometer sent it. Anything the logs do not have is ''.
 */
export function importedDay(
  date: string,
  wellness: GarminWellnessRecord[],
  activities: GarminHealthRecord[],
  nutrition: NutritionDay[] = [],
): ImportedDay {
  const watch = wellness.find((w) => w.date.slice(0, 10) === date)
  const hours = num(watch?.sleep_duration_h)
  const minutes = trainingMinutesOn(activities, date)
  const food = nutrition.find((n) => n.date.slice(0, 10) === date)
  const grams = (v: string | undefined) => (num(v) ? String(Math.round(num(v) as number)) : '')
  return {
    sleep_h: hours ? String(Math.round(hours * 10) / 10) : '',
    min_training: minutes > 0 ? String(minutes) : '',
    protein_g: grams(food?.protein_g),
    carbs_g: grams(food?.carbs_g),
    sugar_g: grams(food?.added_sugar_g) || grams(food?.sugar_g),
  }
}

/**
 * Check-ins with sleep, training and food filled from the logs, so none is typed.
 * Food falls back to what was entered by hand on days Cronometer sent nothing.
 * A day with only imported data becomes a row with no `updated_at`, which the
 * weekly summaries do not count as a check-in.
 */
export function withImported(
  logged: Checkin[],
  wellness: GarminWellnessRecord[],
  activities: GarminHealthRecord[],
  nutrition: NutritionDay[] = [],
): Checkin[] {
  const dates = new Set<string>(logged.map((c) => c.date))
  for (const w of wellness) if (num(w.sleep_duration_h)) dates.add(w.date.slice(0, 10))
  for (const a of activities) dates.add(a.date.slice(0, 10))
  for (const n of nutrition) dates.add(n.date.slice(0, 10))
  const byDate = new Map(logged.map((c) => [c.date, c]))
  return [...dates].sort().map((date) => {
    const base = byDate.get(date) ?? blankCheckin(date)
    const imp = importedDay(date, wellness, activities, nutrition)
    return {
      ...base,
      sleep_h: imp.sleep_h,
      min_training: imp.min_training,
      protein_g: imp.protein_g || base.protein_g,
      carbs_g: imp.carbs_g || base.carbs_g,
      sugar_g: imp.sugar_g || base.sugar_g,
    }
  })
}

export type Upkeep = { masksThisWeek: number; towelDaysAgo: number | null; sheetsDaysAgo: number | null }

/** Masks so far this week (target 2) and days since the towel and sheets were last changed. */
export function upkeep(logged: Checkin[], today: string): Upkeep {
  const start = weekStart(today)
  const since = (field: 'towel' | 'sheets') => {
    const last = logged.filter((c) => c[field] === 'yes' && c.date <= today).map((c) => c.date).sort().slice(-1)[0]
    return last ? daysBetween(last, today) : null
  }
  return {
    masksThisWeek: logged.filter((c) => c.mask === 'yes' && c.date >= start && c.date <= today).length,
    towelDaysAgo: since('towel'),
    sheetsDaysAgo: since('sheets'),
  }
}

/**
 * A day's face acne count: the verified acne circles across the front, left and
 * right shots. `override` stands in for the photo being confirmed right now, whose
 * saved marks are not in `photos` yet. A spot seen from two angles counts twice, so
 * treat the number as a consistent index for trends rather than an exact tally.
 */
export function faceAcneFor(date: string, photos: SkinPhoto[], override?: { photoId: string; acne: number }): number {
  let total = override ? override.acne : 0
  for (const p of photos) {
    if (p.taken_at.slice(0, 10) !== date || !isFaceAngle(p.angle) || !p.verified) continue
    if (override && p.photo_id === override.photoId) continue
    total += parseStoredMarks(p.marks).filter((m) => m.kind === 'acne').length
  }
  return total
}
