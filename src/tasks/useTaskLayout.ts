import { useCallback, useEffect, useState } from 'react'
import { listTaskLayout, saveTaskLayoutRow } from '../data/tasks/layoutClient'
import type { SectionLayout } from './sectionLayout'

export type TaskLayoutStore = {
  layout: SectionLayout
  loaded: boolean
  error: string
  /** Applies the rows at once, then writes each one. A failed write reloads the saved layout. */
  saveRows: (rows: SectionLayout) => Promise<void>
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/** Section order and visibility on the Tasks page, shared across devices through the db Worker. */
export function useTaskLayout(idToken: string, enabled: boolean): TaskLayoutStore {
  const [layout, setLayout] = useState<SectionLayout>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !idToken) return

    let cancelled = false
    listTaskLayout(idToken)
      .then((rows) => {
        if (cancelled) return
        setLayout(rows)
        setLoaded(true)
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, 'Unable to load the task layout'))
      })
    return () => {
      cancelled = true
    }
  }, [idToken, enabled])

  const saveRows = useCallback(
    async (rows: SectionLayout) => {
      setLayout((prev) => ({ ...prev, ...rows }))
      setError('')
      try {
        await Promise.all(Object.entries(rows).map(([id, row]) => saveTaskLayoutRow(idToken, id, row)))
      } catch (caught) {
        setError(errorMessage(caught, 'Saving the task layout failed'))
        try {
          setLayout(await listTaskLayout(idToken))
        } catch {
          // Keep the optimistic layout; the error above already says it did not save.
        }
      }
    },
    [idToken],
  )

  return { layout, loaded, error, saveRows }
}
