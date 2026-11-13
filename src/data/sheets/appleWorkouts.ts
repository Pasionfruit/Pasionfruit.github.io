import type { GarminHealthRecord } from './types'

/** A row of the db Worker's `apple_workouts` table, pushed from Apple Health. */
export type AppleWorkoutRow = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()

/** "Traditional Strength Training" → "strength_training"; the rest become snake_case. */
function activityTypeOf(raw: string): string {
  const snake = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return snake.includes('strength') ? 'strength_training' : snake
}

/** The same session logged twice: one date, durations within 20% (and never under 5 minutes apart). */
function sameSession(workout: GarminHealthRecord, others: GarminHealthRecord[]): boolean {
  const minutes = Number.parseFloat(workout.duration_min)
  if (!Number.isFinite(minutes)) return false
  return others.some((other) => {
    if (other.date.slice(0, 10) !== workout.date) return false
    const otherMinutes = Number.parseFloat(other.duration_min)
    if (!Number.isFinite(otherMinutes)) return false
    return Math.abs(minutes - otherMinutes) <= Math.max(5, 0.2 * Math.max(minutes, otherMinutes))
  })
}

/**
 * Apple Health workouts as training records, appended to the Garmin rows.
 * A workout that matches a Garmin row (the watch also recorded it) is dropped,
 * so a session counts once. `activity_id` carries an "apple_" prefix so it can
 * never collide with Garmin's numeric ids.
 */
export function mergeAppleWorkouts(
  garmin: GarminHealthRecord[],
  appleRows: AppleWorkoutRow[],
): GarminHealthRecord[] {
  const merged = [...garmin]
  for (const row of appleRows) {
    const id = text(row.workout_id)
    const date = (text(row.date) || id).slice(0, 10)
    if (!id || !date) continue

    const type = text(row.type)
    const record: GarminHealthRecord = {
      date,
      activity_type: activityTypeOf(type),
      title: text(row.title) || type,
      distance_mi: text(row.distance_mi),
      duration_min: text(row.duration_min),
      avg_hr: text(row.avg_hr),
      max_hr: text(row.max_hr),
      calories: text(row.calories),
      tss: '',
      activity_id: `apple_${id}`,
    }
    if (sameSession(record, garmin)) continue
    merged.push(record)
  }
  return merged
}
