import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchTimelinePhotoUrl, putPhotoBytes, removePhotoBytes } from '../data/timeline/client'
import { blankCheckin, deleteRow, parseStoredMarks, saveRow, SKIN_ANGLES, type SkinMark, type SkinPhoto } from './client'
import { detectSkinMarks, skinVisionModel } from './detect'
import { LineChart } from './LineChart'
import { MarkedImage } from './MarkEditor'
import { acneTotal, daysBetween, num, todayLocal, type DateRange, inRange } from './analytics'
import type { ProgressData } from './useProgressData'

/** The photo's bytes as an object URL, released when the photo changes. */
function usePhotoUrl(idToken: string, photoId: string) {
  const [state, setState] = useState<{ id: string; src: string; failed: boolean }>({ id: '', src: '', failed: false })
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    fetchTimelinePhotoUrl(idToken, photoId, controller.signal)
      .then((u) => {
        url = u
        setState({ id: photoId, src: u, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ id: photoId, src: '', failed: true })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [idToken, photoId])
  return state.id === photoId ? state : { id: photoId, src: '', failed: false }
}

function SkinImage({ idToken, photo, alt }: { idToken: string; photo: SkinPhoto; alt: string }) {
  const { src, failed } = usePhotoUrl(idToken, photo.photo_id)
  if (failed) return <p className="sheets-meta">This photo could not be loaded.</p>
  if (!src) return <p className="sheets-meta">Loading photo…</p>
  return <MarkedImage src={src} alt={alt} marks={parseStoredMarks(photo.marks)} />
}

/** Review one photo: run the local model, correct its circles, then confirm. */
function Review({ idToken, photo, source, data, onDone }: {
  idToken: string
  photo: SkinPhoto
  /** The just-uploaded file, so the model does not need the photo fetched back. */
  source?: File
  data: ProgressData
  onDone: () => void
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
      // The verified count becomes that day's acne number, so it never has to be typed.
      const date = photo.taken_at.slice(0, 10)
      const existing = data.logged.find((c) => c.date === date) ?? blankCheckin(date)
      await saveRow(idToken, 'progress_checkins', {
        ...existing,
        [photo.angle === 'back' ? 'acne_back' : 'acne_face']: String(acne),
        updated_at: new Date().toISOString(),
      })
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pg-review">
      <h4>Review · {photo.angle} · {photo.taken_at.slice(0, 10)}</h4>
      {!src ? <p className="sheets-meta">Loading photo…</p> : <MarkedImage src={src} alt={`${photo.angle} photo to review`} marks={marks} onChange={phase === 'scanning' ? undefined : setMarks} />}
      <div className="pg-actions">
        {phase !== 'scanning' && <button type="button" className="secondary-action" onClick={scan} disabled={!src}>{phase === 'idle' ? `Find spots (${skinVisionModel()})` : 'Scan again'}</button>}
        {phase === 'scanning' && <span className="sheets-meta" role="status">Your PC is looking at the photo. This can take a minute.</span>}
        <button type="button" className="primary-action" onClick={confirm} disabled={saving || phase === 'scanning'}>
          {saving ? 'Saving…' : `Confirm · ${acne} acne, ${marks.length - acne} scar${marks.length - acne === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="secondary-action" onClick={onDone}>Close</button>
      </div>
      <p className="sheets-meta">The circles are a first guess from a local model. Fix them before confirming. Confirming sets that day&rsquo;s {photo.angle === 'back' ? 'back' : 'face'} acne count.</p>
      {error && <p className="pg-error" role="alert">{error}</p>}
    </section>
  )
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
    const photoId = crypto.randomUUID()
    const row: SkinPhoto = { photo_id: photoId, taken_at: takenAt, angle: uploadAngle, notes: notes.trim(), marks: '[]', verified: '', created_at: new Date().toISOString() }
    try {
      await putPhotoBytes(idToken, photoId, file)
      try {
        await saveRow(idToken, 'progress_skin_photos', row)
      } catch (caught) {
        await removePhotoBytes(idToken, photoId)
        throw caught
      }
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
