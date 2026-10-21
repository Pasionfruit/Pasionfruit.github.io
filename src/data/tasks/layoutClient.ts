/**
 * The Tasks page's section layout, from the db Worker's `tasks_layout` table:
 * one row per Todoist section. Admin-only both ways, so every call carries the
 * dashboards' session.
 */

import type { SectionLayout, SectionLayoutRow } from '../../tasks/sectionLayout'

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

async function failure(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error || `${fallback}: ${response.status}`)
}

export async function listTaskLayout(idToken: string): Promise<SectionLayout> {
  const response = await fetch(`${DB_BASE_URL}/db/tasks_layout`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) throw await failure(response, 'Task layout read failed')

  const data = (await response.json()) as {
    rows?: { item_id: string; project_id: string; position: number; hidden: number }[]
  }
  const layout: SectionLayout = {}
  for (const row of data.rows ?? []) {
    layout[row.item_id] = {
      project_id: row.project_id,
      position: Number(row.position),
      hidden: Boolean(row.hidden),
    }
  }
  return layout
}

export async function saveTaskLayoutRow(idToken: string, itemId: string, row: SectionLayoutRow): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/tasks_layout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_id: itemId,
      project_id: row.project_id,
      position: row.position,
      hidden: row.hidden,
    }),
  })
  if (!response.ok) throw await failure(response, 'Saving the task layout failed')
}
