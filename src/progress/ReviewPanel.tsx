import { useState } from 'react'
import { blankCheckin, isFaceAngle, normalizeAngle, parseStoredMarks, saveRow, type SkinMark, type SkinPhoto } from './client'
import { faceAcneFor } from './analytics'
import { detectSkinMarks, skinVisionModel } from './detect'
import { MarkedImage } from './MarkEditor'
import { usePhotoUrl } from './usePhotoUrl'
import type { ProgressData } from './useProgressData'

/** Review one photo: run the local model, correct its circles, then confirm. */
export function Review({ idToken, photo, source, data, onDone, onCounts }: {
  idToken: string
  photo: SkinPhoto
  /** The just-uploaded file, so the model does not need the photo fetched back. */
  source?: File
  data: ProgressData
  onDone: () => void
  /** When given, the day's count goes back to the caller (the open check-in) instead of being saved to the day's row. */
  onCounts?: (field: 'acne_face' | 'acne_back', count: number) => void
}) {
  const { src } = usePhotoUrl(idToken, photo.photo_id)
  const stored = parseStoredMarks(photo.marks)
  const [marks, setMarks] = useState<SkinMark[]>(stored)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'ready' | 'error'>(stored.length || photo.verified ? 'ready' : 'idle')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const acne = marks.filter((m) => m.kind === 'acne').length

  async function scan() {
    setPhase('scanning')
    setError('')
    try {
      const blob: Blob = source ?? (await (await fetch(src)).blob())
      setMarks(await detectSkinMarks(idToken, blob, photo.angle))
      setPhase('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Scan failed.')
      setPhase('error')
    }
  }

  async function confirm() {
    setSaving(true)
    setError('')
    try {
      await saveRow(idToken, 'progress_skin_photos', { ...photo, marks: JSON.stringify(marks), verified: 'yes' })
      const field = isFaceAngle(photo.angle) ? 'acne_face' : 'acne_back'
      const date = photo.taken_at.slice(0, 10)
      // Face acne sums the day's front, left and right shots; the back is its own count.
      const count = field === 'acne_face' ? faceAcneFor(date, data.photos, { photoId: photo.photo_id, acne }) : acne
      if (onCounts) {
        onCounts(field, count)
      } else {
        // The verified count becomes that day's acne number, so it never has to be typed.
        const existing = data.logged.find((c) => c.date === date) ?? blankCheckin(date)
        await saveRow(idToken, 'progress_checkins', {
          ...existing,
          [field]: String(count),
          updated_at: new Date().toISOString(),
        })
      }
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pg-review">
      <h4>Review · {normalizeAngle(photo.angle)} · {photo.taken_at.slice(0, 10)}</h4>
      {!src ? <p className="sheets-meta">Loading photo…</p> : <MarkedImage src={src} alt={`${photo.angle} photo to review`} marks={marks} onChange={phase === 'scanning' ? undefined : setMarks} />}
      <div className="pg-actions">
        {phase !== 'scanning' && <button type="button" className="secondary-action" onClick={scan} disabled={!src}>{phase === 'idle' ? `Find spots (${skinVisionModel()})` : 'Scan again'}</button>}
        {phase === 'scanning' && <span className="sheets-meta" role="status">Your PC is looking at the photo. This can take a minute.</span>}
        <button type="button" className="primary-action" onClick={confirm} disabled={saving || phase === 'scanning'}>
          {saving ? 'Saving…' : `Confirm · ${acne} acne, ${marks.length - acne} scar${marks.length - acne === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="secondary-action" onClick={onDone}>Close</button>
      </div>
      <p className="sheets-meta">The circles are a first guess from a local model. Fix them before confirming. Confirming sets that day&rsquo;s {isFaceAngle(photo.angle) ? 'face acne count (front, left and right together)' : 'back acne count'}.</p>
      {error && <p className="pg-error" role="alert">{error}</p>}
    </section>
  )
}

