/**
 * The chore card's backlog: one-off to-dos from the db Worker's `backlog` table.
 * Admin-only both ways, so every call carries the dashboards' session.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

export type BacklogItem = {
  id: string
  title: string
  /** '', a local YYYY-MM-DD, or a local YYYY-MM-DDTHH:mm. */
  due: string
  done: boolean
  createdAt: string
}

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

function headers(idToken: string) {
  return { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }
}

type BacklogRow = { item_id: string; title: string; due: string; done: number | string; created_at: string }

export async function listBacklog(idToken: string): Promise<BacklogItem[]> {
  const response = await fetch(`${DB_BASE_URL}/db/backlog`, { headers: headers(idToken) })
  if (!response.ok) throw await failure(response, 'Backlog read failed')

  const data = (await response.json()) as { rows?: BacklogRow[] }
  return (data.rows ?? []).map((row) => ({
    id: row.item_id,
    title: row.title,
    due: row.due ?? '',
    done: Number(row.done) === 1,
    createdAt: row.created_at ?? '',
  }))
}

export async function saveBacklogItem(idToken: string, item: BacklogItem): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/backlog`, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({
      item_id: item.id,
      title: item.title,
      due: item.due,
      done: item.done,
      created_at: item.createdAt,
    }),
  })
  if (!response.ok) throw await failure(response, 'Saving the item failed')
}

export async function deleteBacklogItem(idToken: string, id: string): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/backlog`, {
    method: 'DELETE',
    headers: headers(idToken),
    body: JSON.stringify({ item_id: id }),
  })
  if (!response.ok) throw await failure(response, 'Deleting the item failed')
}
