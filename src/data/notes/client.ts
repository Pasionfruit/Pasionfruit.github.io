/**
 * The Ciara page's sticky notes, from the db Worker's `sticky_notes` table: one
 * row per colour. Admin-only both ways, so every call carries the dashboards' session.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

export type StickyColor = 'yellow' | 'blue' | 'pink'

export const STICKY_COLORS: StickyColor[] = ['yellow', 'blue', 'pink']

function isStickyColor(value: string): value is StickyColor {
  return (STICKY_COLORS as string[]).includes(value)
}

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

/** The saved text of each note. A colour with no row yet is simply missing from the result. */
export async function listStickyNotes(idToken: string): Promise<Partial<Record<StickyColor, string>>> {
  const response = await fetch(`${DB_BASE_URL}/db/sticky_notes`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) throw await failure(response, 'Notes read failed')

  const data = (await response.json()) as { rows?: { note_id: string; body: string }[] }
  const notes: Partial<Record<StickyColor, string>> = {}
  for (const row of data.rows ?? []) {
    if (isStickyColor(row.note_id)) notes[row.note_id] = row.body
  }
  return notes
}

export async function saveStickyNote(idToken: string, color: StickyColor, body: string): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/sticky_notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note_id: color, color, body, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) throw await failure(response, 'Saving the note failed')
}
