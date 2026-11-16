import { useCallback, useEffect, useState } from 'react'
import { getEvents, getGarminHealth, getGarminWellness } from '../data/sheets/repositories'
import type { EventRecord, GarminHealthRecord, GarminWellnessRecord } from '../data/sheets/types'
import { withImported } from './analytics'
import { listRows, type Checkin, type ContentItem, type NutritionDay, type SkinPhoto, type WorkoutRpe } from './client'

export type ProgressData = {
  /** What was saved by hand. */
  logged: Checkin[]
  /** Saved days plus sleep and training from Garmin/Hevy, for every chart. */
  checkins: Checkin[]
  photos: SkinPhoto[]
  content: ContentItem[]
  rpe: WorkoutRpe[]
  nutrition: NutritionDay[]
  activities: GarminHealthRecord[]
  wellness: GarminWellnessRecord[]
  events: EventRecord[]
}

const EMPTY: ProgressData = { logged: [], checkins: [], photos: [], content: [], rpe: [], nutrition: [], activities: [], wellness: [], events: [] }

/**
 * Everything the tracker shows. The imports (Garmin, Apple, wellness, events) are
 * best-effort: if one fails the tracker still works from what was logged by hand.
 */
export function useProgressData(idToken: string) {
  const [data, setData] = useState<ProgressData>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [checkins, photos, content, rpe] = await Promise.all([
          listRows<Checkin>(idToken, 'progress_checkins'),
          listRows<SkinPhoto>(idToken, 'progress_skin_photos'),
          listRows<ContentItem>(idToken, 'progress_content'),
          listRows<WorkoutRpe>(idToken, 'progress_workout_rpe'),
        ])
        const [activities, wellness, events, nutrition] = await Promise.all([
          getGarminHealth().catch(() => []),
          getGarminWellness().catch(() => []),
          getEvents().catch(() => []),
          // Cronometer is optional: a missing table or key just leaves food manual.
          listRows<NutritionDay>(idToken, 'nutrition_daily').catch(() => []),
        ])
        if (cancelled) return
        setData({
          logged: checkins.sort((a, b) => a.date.localeCompare(b.date)),
          checkins: withImported(checkins, wellness, activities, nutrition),
          photos,
          content,
          rpe,
          nutrition,
          activities,
          wellness,
          events,
        })
        setError('')
        setStatus('ready')
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Progress could not be loaded.')
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idToken, reloads])

  const reload = useCallback(() => setReloads((n) => n + 1), [])
  return { data, status, error, reload }
}
