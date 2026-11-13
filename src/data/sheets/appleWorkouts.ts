import type { GarminHealthRecord } from './types'

/** A row of the db Worker's `apple_workouts` table, pushed from Apple Health. */
export type AppleWorkoutRow = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()

/**
 * Minutes from what the Shortcut sent: plain minutes ("52"), or a clock time
 * ("42:13" is 42 min 13 s, "1:05:00" an hour and five) when the Duration was not converted.
 */
function minutesOf(raw: string): string {
  // "42.217 min" (a converted Duration, unit attached) is already minutes.
  const withUnit = /^([\d.]+)\s*min(utes)?$/i.exec(raw)
  if (withUnit) return Number(withUnit[1]).toFixed(1)
  if (!raw.includes(':')) return raw
  const parts = raw.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return raw
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] ?? 0)
  return (seconds / 60).toFixed(1)
}

/** A Shortcut property mix-up leaves an energy reading ("276 Cal") where the type belongs. */
const isEnergyReading = (raw: string) => /^([\d.,\s]+(k?cal|kj)?|active (energy|calories))$/i.test(raw)

/** "Traditional Strength Training" → "strength_training"; the rest become snake_case. */
function activityTypeOf(raw: string): string {
  if (!raw || isEnergyReading(raw)) return 'workout'
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

    const type = isEnergyReading(text(row.type)) ? '' : text(row.type)
    // Shortcuts cannot read a workout's activity kind, only its Source (the app that
    // wrote it). Hevy only records lifting, so a Hevy source is a strength session.
    const fromHevy = /hevy/i.test(`${type} ${text(row.title)}`)
    const calories = Number.parseFloat(text(row.calories))
    const record: GarminHealthRecord = {
      date,
      activity_type: fromHevy ? 'strength_training' : activityTypeOf(type),
      title: fromHevy ? 'Strength (Hevy)' : text(row.title) || type || 'Workout',
      distance_mi: text(row.distance_mi),
      duration_min: minutesOf(text(row.duration_min)),
      avg_hr: text(row.avg_hr),
      max_hr: text(row.max_hr),
      calories: Number.isFinite(calories) ? String(Math.round(calories)) : '',
      tss: '',
      activity_id: `apple_${id}`,
    }
    if (sameSession(record, garmin)) continue
    merged.push(record)
  }
  return merged
}
