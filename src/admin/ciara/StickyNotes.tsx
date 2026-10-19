import { useEffect, useState } from 'react'
import { listStickyNotes, saveStickyNote, STICKY_COLORS, type StickyColor } from '../../data/notes/client'

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

const EMPTY: Record<StickyColor, string> = { yellow: '', blue: '', pink: '' }

/** Three editable sticky notes. Each one saves when you click away from it. */
export function StickyNotes({ idToken }: { idToken: string }) {
  const [texts, setTexts] = useState<Record<StickyColor, string>>(EMPTY)
  const [status, setStatus] = useState<Status>('loading')
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

  async function save(color: StickyColor) {
    setStatus('saving')
    setError('')
    try {
      await saveStickyNote(idToken, color, texts[color])
      setStatus('saved')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The note could not be saved.')
      setStatus('error')
    }
  }

  return (
    <section className="ciara-notes" aria-label="Sticky notes">
      <div className="ciara-notes-row">
        {STICKY_COLORS.map((color) => (
          <label key={color} className={`ciara-sticky ciara-sticky-${color}`}>
            <span className="ciara-sticky-tape" aria-hidden="true" />
            <span className="ciara-sticky-label">{color} note</span>
            <textarea
              value={texts[color]}
              maxLength={500}
              placeholder="Write something…"
              disabled={status === 'loading'}
              onChange={(event) => setTexts((current) => ({ ...current, [color]: event.target.value }))}
              onBlur={() => void save(color)}
            />
          </label>
        ))}
      </div>
      <p className="ciara-notes-status" role="status" aria-live="polite">
        {status === 'loading' ? 'Loading notes…' : null}
        {status === 'saving' ? 'Saving…' : null}
        {status === 'saved' ? 'Saved' : null}
        {status === 'error' ? error : null}
      </p>
    </section>
  )
}
