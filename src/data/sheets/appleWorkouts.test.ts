import { describe, expect, it } from 'vitest'
import { mergeAppleWorkouts } from './appleWorkouts'
import type { GarminHealthRecord } from './types'

const garminRun: GarminHealthRecord = {
  date: '2026-11-13',
  activity_type: 'running',
  title: 'Morning run',
  distance_mi: '3.1',
  duration_min: '28.0',
  avg_hr: '150',
  max_hr: '170',
  calories: '300',
  tss: '',
  activity_id: '123',
}

const lift = { workout_id: '2026-11-13T18:00', date: '2026-11-13', type: 'Traditional Strength Training', duration_min: '52', calories: '240' }

describe('mergeAppleWorkouts', () => {
  it('adds a workout Garmin did not record, as strength_training', () => {
    const merged = mergeAppleWorkouts([garminRun], [lift])

    expect(merged).toHaveLength(2)
    expect(merged[1]).toMatchObject({
      date: '2026-11-13',
      activity_type: 'strength_training',
      title: 'Traditional Strength Training',
      duration_min: '52',
      calories: '240',
      activity_id: 'apple_2026-11-13T18:00',
    })
  })

  it('drops a workout the watch already logged the same day with a similar length', () => {
    const watchLift = { ...garminRun, activity_type: 'strength_training', duration_min: '50.0' }
    expect(mergeAppleWorkouts([watchLift], [lift])).toHaveLength(1)
  })

  it('keeps a same-day workout of a clearly different length', () => {
    expect(mergeAppleWorkouts([garminRun], [{ ...lift, duration_min: '90' }])).toHaveLength(2)
  })

  it('falls back to the id for the date and skips rows with no id', () => {
    const merged = mergeAppleWorkouts([], [{ workout_id: '2026-11-12T07:00', type: 'Running' }, { type: 'Running' }])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ date: '2026-11-12', activity_type: 'running' })
  })

  it('reads a clock-time duration, rounds energy, and ignores an energy reading in place of the type', () => {
    const [record] = mergeAppleWorkouts([], [
      { workout_id: '2026-11-10T06:48', date: '2026-11-10', type: '219 Cal', duration_min: '38:16', calories: '26.81000000000004' },
    ])

    expect(record).toMatchObject({ activity_type: 'workout', title: 'Workout', duration_min: '38.3', calories: '27' })
  })

  it('reads an hours clock time', () => {
    const [record] = mergeAppleWorkouts([], [{ workout_id: '2026-11-10T06:48', duration_min: '1:05:00' }])
    expect(record.duration_min).toBe('65.0')
  })

  it('treats a Hevy source as a strength session', () => {
    const [record] = mergeAppleWorkouts([], [{ workout_id: '2026-11-10T06:48', title: 'Hevy', duration_min: '45' }])
    expect(record).toMatchObject({ activity_type: 'strength_training', title: 'Strength (Hevy)' })
  })

  it('reads a duration that carries its unit, and ignores an "Active Calories" label as the type', () => {
    const [record] = mergeAppleWorkouts([], [{ workout_id: '2026-11-10T06:48', type: 'Active Calories', duration_min: '42.217 min' }])
    expect(record).toMatchObject({ activity_type: 'workout', title: 'Workout', duration_min: '42.2' })
  })
})
