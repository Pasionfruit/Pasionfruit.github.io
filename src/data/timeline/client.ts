/**
 * The Ciara page's photo timeline, from the db Worker: metadata rows in the
 * `timeline_photos` table, image bytes at /photos/<id> (workers/db/photos.js).
 * Admin-only both ways, so every call carries the same session the dashboards use.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

/** Longest edge kept after resizing. Phone photos are 3–5 MB; this keeps them a fraction of that. */
const MAX_EDGE = 2000

export type TimelinePhoto = {
  photo_id: string
  /** datetime-local value ("2024-02-14T19:30"), read as local time. */
  taken_at: string
  caption: string
  created_at: string
}

function authHeaders(idToken: string): Record<string, string> {
  return { Authorization: `Bearer ${idToken}` }
}

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

export async function listTimelinePhotos(idToken: string): Promise<TimelinePhoto[]> {
  const response = await fetch(`${DB_BASE_URL}/db/timeline_photos`, { headers: authHeaders(idToken) })
  if (!response.ok) throw await failure(response, 'Timeline read failed')
  const data = (await response.json()) as { rows?: TimelinePhoto[] }
  return data.rows ?? []
}

/** Shrink a photo to a JPEG no wider or taller than MAX_EDGE. Throws if the browser cannot decode it. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.")
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error("Couldn't prepare that photo.")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!blob) throw new Error("Couldn't prepare that photo.")
  return blob
}

export async function uploadTimelinePhoto(
  idToken: string,
  { file, takenAt, caption }: { file: File; takenAt: string; caption: string },
): Promise<void> {
  const photoId = crypto.randomUUID()
  const image = await shrinkPhoto(file)

  const upload = await fetch(`${DB_BASE_URL}/photos/${photoId}`, {
    method: 'POST',
    headers: { ...authHeaders(idToken), 'Content-Type': image.type },
    body: image,
  })
  if (!upload.ok) throw await failure(upload, 'Photo upload failed')

  const row = await fetch(`${DB_BASE_URL}/db/timeline_photos`, {
    method: 'POST',
    headers: { ...authHeaders(idToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, taken_at: takenAt, caption: caption.trim(), created_at: new Date().toISOString() }),
  })
  if (!row.ok) {
    // Without its row the photo would never show, so take the bytes back out.
    await fetch(`${DB_BASE_URL}/photos/${photoId}`, { method: 'DELETE', headers: authHeaders(idToken) })
    throw await failure(row, 'Saving the photo failed')
  }
}

export async function deleteTimelinePhoto(idToken: string, photoId: string): Promise<void> {
  const row = await fetch(`${DB_BASE_URL}/db/timeline_photos`, {
    method: 'DELETE',
    headers: { ...authHeaders(idToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId }),
  })
  if (!row.ok) throw await failure(row, 'Delete failed')

  await fetch(`${DB_BASE_URL}/photos/${photoId}`, { method: 'DELETE', headers: authHeaders(idToken) })
}

/** The photo's bytes as an object URL. The caller revokes it when done. */
export async function fetchTimelinePhotoUrl(idToken: string, photoId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${DB_BASE_URL}/photos/${photoId}`, { headers: authHeaders(idToken), signal })
  if (!response.ok) throw await failure(response, 'Photo read failed')
  return URL.createObjectURL(await response.blob())
}
