import type { GarminHealthRecord, TrainingRecord } from '../data/sheets/types'

export function isRestDayWorkout(value?: string) {
  if (!value) {
    return false
  }

  return value.trim().toLowerCase() === 'rest day'
}

/** "Pool Swim · 30 min" — how the log and the daily card name an activity. */
export function describeGarminActivity(row: GarminHealthRecord) {
  const name = (row.title || row.activity_type || 'Activity').trim()
  const minutes = Number(row.duration_min)
  return Number.isFinite(minutes) && minutes > 0 ? `${name} · ${Math.round(minutes)} min` : name
}

/**
 * Orders a day's activities by when they happened. Garmin's activity ids rise
 * over time; rows ingested before the id column existed have none, and keep
 * their sheet order after the ones that do.
 */
export function byGarminStartOrder(a: GarminHealthRecord, b: GarminHealthRecord) {
  const rank = (row: GarminHealthRecord) => (row.activity_id ? Number(row.activity_id) : Number.POSITIVE_INFINITY)
  const [rankA, rankB] = [rank(a), rank(b)]
  return rankA === rankB ? 0 : rankA < rankB ? -1 : 1
}

export type PlannedWorkout = { workout: string; isPlanned: boolean; activity?: GarminHealthRecord }

/**
 * Today's plan beside what Garmin recorded. Activities fill the planned slots
 * in the order they happened; an empty slot or a rest day takes none, so an
 * evening session is not spent on a morning with nothing planned. Activities
 * beyond the plan come back as `unplanned`.
 */
export function pairPlanWithGarmin(plan: TrainingRecord | undefined, activities: GarminHealthRecord[]) {
  const unclaimed = [...activities].sort(byGarminStartOrder)
  const planned: PlannedWorkout[] = plan
    ? [plan.morning_workout ?? '', plan.evening_workout ?? ''].map((workout) => {
        const isPlanned = Boolean(workout.trim()) && !isRestDayWorkout(workout)
        return { workout, isPlanned, activity: isPlanned ? unclaimed.shift() : undefined }
      })
    : []

  return { planned, unplanned: unclaimed }
}

export function parseTrainingDate(value?: string) {
  if (!value) {
    return null
  }

  /*
   * A bare 'YYYY-MM-DD' is parsed by `new Date()` as UTC midnight, which in any
   * negative-offset zone lands on the previous day locally — putting every
   * contribution tile one day early, in the wrong weekday column. Date-only
   * strings are calendar dates, so build them in local time.
   */
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function toDateOnlyKey(value?: string) {
  if (!value) {
    return ''
  }

  /*
   * Must parse the same way the grid does. `new Date('2026-08-02')` is UTC
   * midnight, which in a negative-offset zone is the previous day locally — so
   * a record keyed here landed one slot earlier than the tile that rendered it,
   * leaving the real day padded and the record duplicated a day early.
   */
  const parsed = parseTrainingDate(value)
  if (!parsed) {
    return ''
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}
