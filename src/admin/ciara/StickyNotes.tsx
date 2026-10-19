import type { StickyColor } from '../../data/notes/client'
import type { StickyNotesState, StickyStatus } from './useStickyNotes'

/** One sticky note. Its text is shared through the hook, and it saves when you click away. */
export function StickyNote({
  color,
  notes,
  className = '',
}: {
  color: StickyColor
  notes: StickyNotesState
  className?: string
}) {
  return (
    <label className={`ciara-sticky ciara-sticky-${color} ${className}`}>
      <span className="ciara-sticky-tape" aria-hidden="true" />
      <span className="ciara-sticky-label">{color} note</span>
      <textarea
        value={notes.texts[color]}
        maxLength={500}
        placeholder="Write something…"
        disabled={notes.status === 'loading'}
        onChange={(event) => notes.setText(color, event.target.value)}
        onBlur={() => void notes.save(color, notes.texts[color])}
      />
    </label>
  )
}

/** Save progress for all the notes, shown in the top bar. */
export function StickyStatus({ status, error }: { status: StickyStatus; error: string }) {
  const message =
    status === 'loading' ? 'Loading notes…' : status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? error : ''
  return (
    <p className="ciara-notes-status" role="status" aria-live="polite">
      {message}
    </p>
  )
}
