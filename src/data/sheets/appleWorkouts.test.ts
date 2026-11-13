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
})
