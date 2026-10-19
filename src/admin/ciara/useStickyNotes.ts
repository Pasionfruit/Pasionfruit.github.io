import { useCallback, useEffect, useState } from 'react'
import { listStickyNotes, saveStickyNote, type StickyColor } from '../../data/notes/client'

export type StickyStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

const EMPTY: Record<StickyColor, string> = { yellow: '', blue: '', pink: '' }

/** The three notes' text, and saving them. One hook feeds all three notes wherever they sit. */
export function useStickyNotes(idToken: string) {
  const [texts, setTexts] = useState<Record<StickyColor, string>>(EMPTY)
  const [status, setStatus] = useState<StickyStatus>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listStickyNotes(idToken)
      .then((saved) => {
        if (cancelled) return
        setTexts((current) => ({ ...current, ...saved }))
        setStatus('idle')
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'The notes could not be loaded.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [idToken])

  const setText = useCallback((color: StickyColor, body: string) => {
    setTexts((current) => ({ ...current, [color]: body }))
  }, [])

  const save = useCallback(
    async (color: StickyColor, body: string) => {
      setStatus('saving')
      setError('')
      try {
        await saveStickyNote(idToken, color, body)
        setStatus('saved')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The note could not be saved.')
        setStatus('error')
      }
    },
    [idToken],
  )

  return { texts, status, error, setText, save }
}

export type StickyNotesState = ReturnType<typeof useStickyNotes>
