/**
 * The Progress tracker's data, from the db Worker's progress_* tables. All of it
 * is admin-only, so every call carries the same session the dashboards use.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

/** Every field is text; '' means "skipped". */
export type Checkin = {
  date: string
  am_done: string
  pm_done: string
  /** 'yes' on days the towel / bed sheets were changed or a mask was done. */
  towel: string
  sheets: string
  mask: string
  acne_face: string
  acne_back: string
  redness: string
  scar: string
  products: string
  sleep_h: string
  energy: string
  mood: string
  stress: string
  sugar_g: string
  protein_g: string
  carbs_g: string
  dairy: string
  min_training: string
  min_content: string
  min_leisure: string
  notes: string
  updated_at: string
}

export const SKIN_ANGLES = ['face', 'back'] as const
export type SkinAngle = (typeof SKIN_ANGLES)[number]

/** A circled spot. x and y are the centre, r the radius, all as a fraction of the image width. */
export type SkinMark = { kind: 'acne' | 'scar'; x: number; y: number; r: number }

export type SkinPhoto = {
  photo_id: string
  taken_at: string
  angle: string
  notes: string
  /** JSON array of SkinMark. */
  marks: string
  /** 'yes' once the marks have been checked by hand. */
  verified: string
  created_at: string
}

export function parseStoredMarks(text: string | undefined): SkinMark[] {
  try {
    const value = JSON.parse(text || '[]') as unknown
    return Array.isArray(value)
      ? value.filter((m): m is SkinMark => !!m && (m.kind === 'acne' || m.kind === 'scar') && [m.x, m.y, m.r].every(Number.isFinite))
      : []
  } catch {
    return []
  }
}

export function blankCheckin(date: string): Checkin {
  return {
    date, am_done: '', pm_done: '', towel: '', sheets: '', mask: '', acne_face: '', acne_back: '', redness: '', scar: '', products: '',
    sleep_h: '', energy: '', mood: '', stress: '', sugar_g: '', protein_g: '', carbs_g: '', dairy: '',
    min_training: '', min_content: '', min_leisure: '', notes: '', updated_at: '',
  }
}

export const CONTENT_STATUSES = ['idea', 'filming', 'editing', 'published'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_CATEGORIES = [
  'Endurance & progress',
  'Gluten-free recreations',
  'Experiments & challenges',
] as const

export type ContentItem = {
  content_id: string
  title: string
  status: string
  platform: string
  category: string
  post_date: string
  filming_min: string
  editing_min: string
  views: string
  likes: string
  comments: string
  notes: string
  updated_at: string
}

export type WorkoutRpe = { workout_key: string; rpe: string; updated_at: string }

export type ProgressTable = 'progress_checkins' | 'progress_skin_photos' | 'progress_content' | 'progress_workout_rpe'

function headers(idToken: string, json = false): Record<string, string> {
  return json ? { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${idToken}` }
}

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

export async function listRows<T>(idToken: string, table: ProgressTable): Promise<T[]> {
  const response = await fetch(`${DB_BASE_URL}/db/${table}`, { headers: headers(idToken) })
  if (!response.ok) throw await failure(response, 'Read failed')
  const data = (await response.json()) as { rows?: T[] }
  return data.rows ?? []
}

/** Create or replace one row (the Worker upserts on the primary key). */
export async function saveRow(idToken: string, table: ProgressTable, row: object): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/${table}`, {
    method: 'POST',
    headers: headers(idToken, true),
    body: JSON.stringify(row),
  })
  if (!response.ok) throw await failure(response, 'Saving failed')
}

export async function deleteRow(idToken: string, table: ProgressTable, keyColumn: string, key: string): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/${table}`, {
    method: 'DELETE',
    headers: headers(idToken, true),
    body: JSON.stringify({ [keyColumn]: key }),
  })
  if (!response.ok) throw await failure(response, 'Delete failed')
}
