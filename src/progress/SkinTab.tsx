import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchTimelinePhotoUrl, putPhotoBytes, removePhotoBytes } from '../data/timeline/client'
import { deleteRow, saveRow, SKIN_ANGLES, type SkinPhoto } from './client'
import { LineChart } from './LineChart'
import { acneTotal, daysBetween, num, todayLocal, type DateRange, inRange } from './analytics'
import type { ProgressData } from './useProgressData'

function SkinImage({ idToken, photoId, alt }: { idToken: string; photoId: string; alt: string }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    fetchTimelinePhotoUrl(idToken, photoId, controller.signal)
      .then((u) => {
        url = u
        setSrc(u)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [idToken, photoId])
  if (failed) return <p className="sheets-meta">This photo could not be loaded.</p>
  if (!src) return <p className="sheets-meta">Loading photo…</p>
  return <img className="pg-photo" src={src} alt={alt} loading="lazy" />
}

/** Every day on the same angle, oldest first. */
function forAngle(photos: SkinPhoto[], angle: string) {
  return photos.filter((p) => p.angle === angle).sort((a, b) => a.taken_at.localeCompare(b.taken_at))
}

export function SkinTab({ idToken, data, range, onChanged }: { idToken: string; data: ProgressData; range: DateRange; onChanged: () => void }) {
  const [angle, setAngle] = useState<string>('front')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [takenAt, setTakenAt] = useState(todayLocal)
  const [uploadAngle, setUploadAngle] = useState<string>('front')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    const photoId = crypto.randomUUID()
    try {
      await putPhotoBytes(idToken, photoId, file)
      try {
        await saveRow(idToken, 'progress_skin_photos', {
          photo_id: photoId, taken_at: takenAt, angle: uploadAngle, notes: notes.trim(), created_at: new Date().toISOString(),
        })
      } catch (caught) {
        await removePhotoBytes(idToken, photoId)
        throw caught
      }
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
        {daysSince === null ? 'No photos yet. Take a set (front, left, right, back) in the same light.' : due ? `Last photos were ${daysSince} days ago. A new set is due (every 2 weeks).` : `Last photos ${daysSince} day${daysSince === 1 ? '' : 's'} ago. Next set in ${14 - daysSince} days.`}
      </p>

      <div className="pg-charts">
        <LineChart title="Active acne" series={[
          { label: 'Total', color: 'var(--danger)', points: pts(acneTotal) },
        ]} />
        <LineChart title="Redness & scar texture (1–5)" series={[
          { label: 'Redness', color: '#f97316', points: pts((c) => num(c.redness)) },
          { label: 'Scars', color: '#8b5cf6', points: pts((c) => num(c.scar)) },
        ]} />
      </div>

      <div className="pg-subtabs" role="group" aria-label="Angle">
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
              <SkinImage idToken={idToken} photoId={shot.photo_id} alt={`${angle} skin photo, ${shot.taken_at.slice(0, 10)}`} />
              {shot.notes && <p className="sheets-meta">{shot.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <details className="pg-details">
        <summary>All {angle} photos ({shots.length})</summary>
        <ul className="pg-list">
          {[...shots].reverse().map((p) => (
            <li key={p.photo_id}>
              <span>{p.taken_at.slice(0, 10)}{p.notes ? ` · ${p.notes}` : ''}</span>
              <button type="button" className="secondary-action" onClick={() => remove(p)}>Delete</button>
            </li>
          ))}
        </ul>
      </details>

      <form className="pg-form" onSubmit={upload}>
        <h4>Add a photo</h4>
        <div className="pg-grid">
          <label className="pg-field"><span>Photo</span><input key={fileKey} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="pg-field"><span>Date</span><input type="date" value={takenAt} max={todayLocal()} onChange={(e) => setTakenAt(e.target.value)} /></label>
          <label className="pg-field"><span>Angle</span>
            <select value={uploadAngle} onChange={(e) => setUploadAngle(e.target.value)}>{SKIN_ANGLES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          </label>
          <label className="pg-field"><span>Note</span><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        <div className="pg-actions">
          <button type="submit" className="primary-action" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload'}</button>
          <span className="sheets-meta">Private: only your signed-in session can open these.</span>
          {error && <span className="pg-error" role="alert">{error}</span>}
        </div>
      </form>
    </div>
  )
}
