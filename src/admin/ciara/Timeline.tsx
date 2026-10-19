import { useEffect, useState, type FormEvent } from 'react'
import {
  deleteTimelinePhoto,
  fetchTimelinePhotoUrl,
  listTimelinePhotos,
  uploadTimelinePhoto,
  type TimelinePhoto,
} from '../../data/timeline/client'

/** Local "YYYY-MM-DDTHH:mm", the value a datetime-local input takes. */
function localNowKey() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function formatTaken(takenAt: string) {
  const date = new Date(takenAt)
  if (!takenAt || Number.isNaN(date.getTime())) return 'No date'
  return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
}

function TimelinePhotoImage({ idToken, photoId, alt }: { idToken: string; photoId: string; alt: string }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    fetchTimelinePhotoUrl(idToken, photoId, controller.signal)
      .then((url) => {
        objectUrl = url
        setSrc(url)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [idToken, photoId])

  if (failed) return <p className="sheets-meta">This photo could not be loaded.</p>
  if (!src) return <p className="sheets-meta">Loading photo…</p>
  return <img className="timeline-photo" src={src} alt={alt} loading="lazy" />
}

export function Timeline({ idToken }: { idToken: string }) {
  const [photos, setPhotos] = useState<TimelinePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloads, setReloads] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [takenAt, setTakenAt] = useState(localNowKey)
  const [caption, setCaption] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const rows = await listTimelinePhotos(idToken)
        if (!cancelled) {
          setPhotos(rows)
          setLoadError('')
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'The timeline could not be loaded.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idToken, reloads])

  // Oldest first, undated photos last, so the timeline reads from the start of the story down to today.
  const ordered = [...photos].sort(
    (a, b) => (a.taken_at ? 0 : 1) - (b.taken_at ? 0 : 1) || (a.taken_at || '').localeCompare(b.taken_at || ''),
  )

  // Consecutive photos from the same year share one row, and so one line.
  const years: { year: string; photos: TimelinePhoto[] }[] = []
  for (const photo of ordered) {
    const year = /^\d{4}/.test(photo.taken_at) ? photo.taken_at.slice(0, 4) : 'Undated'
    const last = years[years.length - 1]
    if (last?.year === year) last.photos.push(photo)
    else years.push({ year, photos: [photo] })
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setIsSaving(true)
    setSaveError('')
    try {
      await uploadTimelinePhoto(idToken, { file, takenAt, caption })
      setFile(null)
      setCaption('')
      setTakenAt(localNowKey())
      setFileKey((key) => key + 1)
      setReloads((count) => count + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The photo could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(photoId: string) {
    if (!window.confirm('Remove this photo from the timeline?')) return
    setSaveError('')
    try {
      await deleteTimelinePhoto(idToken, photoId)
      setPhotos((current) => current.filter((photo) => photo.photo_id !== photoId))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The photo could not be removed.')
    }
  }

  return (
    <article className="info-card admin-card admin-card-wide ciara-timeline">
      <div className="admin-card-head">
        <div>
          <h2>Timeline</h2>
          <p className="sheets-meta">Photos, oldest first.</p>
        </div>
      </div>

      <form className="ciara-upload" onSubmit={handleUpload}>
        <label className="ciara-field">
          <span>Photo</span>
          <input
            key={fileKey}
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={isSaving}
          />
        </label>
        <label className="ciara-field">
          <span>Taken</span>
          <input type="datetime-local" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} disabled={isSaving} />
        </label>
        <label className="ciara-field ciara-field-wide">
          <span>Caption</span>
          <input
            type="text"
            maxLength={200}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="What was happening?"
            disabled={isSaving}
          />
        </label>
        <button type="submit" className="primary-action" disabled={!file || isSaving}>
          {isSaving ? 'Uploading…' : 'Add photo'}
        </button>
      </form>

      {saveError ? <p className="sheets-error">{saveError}</p> : null}

      {isLoading && photos.length === 0 ? <p className="sheets-meta">Loading timeline…</p> : null}
      {loadError ? <p className="sheets-error">{loadError}</p> : null}
      {!isLoading && !loadError && ordered.length === 0 ? (
        <p className="sheets-meta">No photos yet. Add the first one above.</p>
      ) : null}

      <div className="timeline" aria-label="Photo timeline">
        {years.map((group) => (
          <section className="timeline-year" key={group.year}>
            <div className="timeline-rail">
              <span className="timeline-year-label">{group.year}</span>
            </div>
            <ol className="timeline-entries">
              {group.photos.map((photo) => (
                <li className="timeline-item" key={photo.photo_id}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div className="timeline-body">
                    <p className="timeline-date">{formatTaken(photo.taken_at)}</p>
                    <TimelinePhotoImage idToken={idToken} photoId={photo.photo_id} alt={photo.caption || 'Timeline photo'} />
                    {photo.caption ? <p className="timeline-caption">{photo.caption}</p> : null}
                    <button type="button" className="secondary-action timeline-remove" onClick={() => handleDelete(photo.photo_id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </article>
  )
}
