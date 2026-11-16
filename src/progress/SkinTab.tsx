import { useMemo, useState, type FormEvent } from 'react'
import { removePhotoBytes } from '../data/timeline/client'
import { deleteRow, parseStoredMarks, SKIN_ANGLES, type SkinPhoto } from './client'
import { Review } from './ReviewPanel'
import { usePhotoUrl } from './usePhotoUrl'
import { addSkinPhoto } from './skinPhotos'
import { LineChart } from './LineChart'
import { MarkedImage } from './MarkEditor'
import { acneTotal, daysBetween, num, todayLocal, type DateRange, inRange } from './analytics'
import type { ProgressData } from './useProgressData'

function SkinImage({ idToken, photo, alt }: { idToken: string; photo: SkinPhoto; alt: string }) {
  const { src, failed } = usePhotoUrl(idToken, photo.photo_id)
  if (failed) return <p className="sheets-meta">This photo could not be loaded.</p>
  if (!src) return <p className="sheets-meta">Loading photo…</p>
  return <MarkedImage src={src} alt={alt} marks={parseStoredMarks(photo.marks)} />
}

/** Every photo of an angle, oldest first. */
function forAngle(photos: SkinPhoto[], angle: string) {
  return photos.filter((p) => p.angle === angle).sort((a, b) => a.taken_at.localeCompare(b.taken_at))
}

export function SkinTab({ idToken, data, range, onChanged }: { idToken: string; data: ProgressData; range: DateRange; onChanged: () => void }) {
  const [angle, setAngle] = useState<string>('face')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [takenAt, setTakenAt] = useState(todayLocal)
  const [uploadAngle, setUploadAngle] = useState<string>('face')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reviewing, setReviewing] = useState<{ photo: SkinPhoto; source?: File } | null>(null)

  const shots = useMemo(() => forAngle(data.photos, angle), [data.photos, angle])
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const left = shots.find((p) => p.photo_id === leftId) ?? shots[0]
  const right = shots.find((p) => p.photo_id === rightId) ?? shots[shots.length - 1]

  const newest = data.photos.map((p) => p.taken_at.slice(0, 10)).sort().slice(-1)[0]
  const daysSince = newest ? daysBetween(newest, todayLocal()) : null
  const due = daysSince === null || daysSince >= 14

  const rows = data.checkins.filter((c) => inRange(c.date, range))
  const pts = (pick: (c: (typeof rows)[number]) => number | null) =>
    rows.flatMap((c) => {
      const y = pick(c)
      return y === null ? [] : [{ x: c.date, y }]
    })

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const row = await addSkinPhoto(idToken, file, takenAt, uploadAngle, notes.trim())
      setReviewing({ photo: row, source: file })
      setFile(null)
      setFileKey((k) => k + 1)
      setNotes('')
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(photo: SkinPhoto) {
    if (!window.confirm('Delete this photo?')) return
    try {
      await deleteRow(idToken, 'progress_skin_photos', 'photo_id', photo.photo_id)
      await removePhotoBytes(idToken, photo.photo_id)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delete failed.')
    }
  }

  return (
    <div className="pg-stack">
      <p className={due ? 'pg-banner' : 'sheets-meta'}>
        {daysSince === null ? 'No photos yet. Take a face and a back photo in the same light.' : due ? `Last photos were ${daysSince} days ago. A new set is due (every 2 weeks).` : `Last photos ${daysSince} day${daysSince === 1 ? '' : 's'} ago. Next set in ${14 - daysSince} days.`}
      </p>

      <form className="pg-form" onSubmit={upload}>
        <h4>Add a photo</h4>
        <div className="pg-grid">
          <label className="pg-field"><span>Photo</span><input key={fileKey} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="pg-field"><span>Date</span><input type="date" value={takenAt} max={todayLocal()} onChange={(e) => setTakenAt(e.target.value)} /></label>
          <label className="pg-field"><span>Photo of</span>
            <select value={uploadAngle} onChange={(e) => setUploadAngle(e.target.value)}>{SKIN_ANGLES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          </label>
          <label className="pg-field"><span>Note</span><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        <div className="pg-actions">
          <button type="submit" className="primary-action" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload and find spots'}</button>
          <span className="sheets-meta">Private: only your signed-in session can open these.</span>
          {error && <span className="pg-error" role="alert">{error}</span>}
        </div>
      </form>

      {reviewing && (
        <Review key={reviewing.photo.photo_id} idToken={idToken} photo={reviewing.photo} source={reviewing.source} data={data} onDone={() => { setReviewing(null); onChanged() }} />
      )}

      <div className="pg-charts">
        <LineChart title="Active acne" series={[{ label: 'Total', color: 'var(--danger)', points: pts(acneTotal) }]} />
        <LineChart title="Redness & scar texture (1–5)" series={[
          { label: 'Redness', color: '#f97316', points: pts((c) => num(c.redness)) },
          { label: 'Scars', color: '#8b5cf6', points: pts((c) => num(c.scar)) },
        ]} />
      </div>

      <div className="pg-subtabs" role="group" aria-label="Photo of">
        {SKIN_ANGLES.map((a) => (
          <button key={a} type="button" className={angle === a ? 'is-on' : ''} aria-pressed={angle === a} onClick={() => { setAngle(a); setLeftId(''); setRightId('') }}>{a}</button>
        ))}
      </div>

      {shots.length < 2 ? (
        <p className="sheets-meta">Add at least two {angle} photos to compare them side by side.</p>
      ) : (
        <div className="pg-compare">
          {[{ shot: left, set: setLeftId, label: 'Before' }, { shot: right, set: setRightId, label: 'After' }].map(({ shot, set, label }) => (
            <div key={label}>
              <label className="pg-field">
                <span>{label}</span>
                <select value={shot.photo_id} onChange={(e) => set(e.target.value)}>
                  {shots.map((p) => <option key={p.photo_id} value={p.photo_id}>{p.taken_at.slice(0, 10)}</option>)}
                </select>
              </label>
              <SkinImage idToken={idToken} photo={shot} alt={`${angle} skin photo, ${shot.taken_at.slice(0, 10)}`} />
              {shot.notes && <p className="sheets-meta">{shot.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <details className="pg-details">
        <summary>All {angle} photos ({shots.length})</summary>
        <ul className="pg-list">
          {[...shots].reverse().map((p) => {
            const m = parseStoredMarks(p.marks)
            const a = m.filter((x) => x.kind === 'acne').length
            return (
              <li key={p.photo_id}>
                <span>{p.taken_at.slice(0, 10)} · {p.verified ? `${a} acne, ${m.length - a} scar${m.length - a === 1 ? '' : 's'}` : 'not reviewed'}{p.notes ? ` · ${p.notes}` : ''}</span>
                <span className="pg-row-actions">
                  <button type="button" className="secondary-action" onClick={() => setReviewing({ photo: p })}>{p.verified ? 'Edit marks' : 'Review'}</button>
                  <button type="button" className="secondary-action" onClick={() => remove(p)}>Delete</button>
                </span>
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}
