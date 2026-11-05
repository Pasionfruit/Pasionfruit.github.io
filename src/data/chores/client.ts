/**
 * The home dashboard's chores, from the db Worker's `chores` table. Admin-only
 * both ways, so every call carries the dashboards' session.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

export const CHORE_CATEGORIES = ['kitchen', 'laundry', 'hygiene', 'cats', 'technical'] as const
export type ChoreCategory = (typeof CHORE_CATEGORIES)[number]

export const CHORE_CATEGORY_LABELS: Record<ChoreCategory, string> = {
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  hygiene: 'Hygiene',
  cats: 'Cats',
  technical: 'Technical',
}

export type Chore = {
  id: string
  name: string
  category: ChoreCategory
  intervalDays: number
  /** Local YYYY-MM-DD, or '' if it has never been done. */
  lastDone: string
}

export function isChoreCategory(value: string): value is ChoreCategory {
  return (CHORE_CATEGORIES as readonly string[]).includes(value)
}

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

function headers(idToken: string) {
  return { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }
}

type ChoreRow = {
  chore_id: string
  name: string
  category: string
  interval_days: number
  last_done: string
}

export async function listChores(idToken: string): Promise<Chore[]> {
  const response = await fetch(`${DB_BASE_URL}/db/chores`, { headers: headers(idToken) })
  if (!response.ok) throw await failure(response, 'Chores read failed')

  const data = (await response.json()) as { rows?: ChoreRow[] }
  return (data.rows ?? [])
    .filter((row) => isChoreCategory(row.category))
    .map((row) => ({
      id: row.chore_id,
      name: row.name,
      category: row.category as ChoreCategory,
      intervalDays: Number(row.interval_days) || 7,
      lastDone: row.last_done ?? '',
    }))
}

export async function saveChore(idToken: string, chore: Chore): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/chores`, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({
      chore_id: chore.id,
      name: chore.name,
      category: chore.category,
      interval_days: chore.intervalDays,
      last_done: chore.lastDone,
      created_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) throw await failure(response, 'Saving the chore failed')
}

export async function deleteChore(idToken: string, id: string): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/chores`, {
    method: 'DELETE',
    headers: headers(idToken),
    body: JSON.stringify({ chore_id: id }),
  })
  if (!response.ok) throw await failure(response, 'Deleting the chore failed')
}
