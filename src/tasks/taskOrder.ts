// Manual task ordering persisted per list (localStorage). Todoist's unified API
// has no reorder endpoint, so drag order is stored on the device and layered on
// top of each view's default sort — new/unknown tasks fall in after saved ones.

const KEY_PREFIX = 'todoist-order:'

export function getSavedOrder(orderKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + orderKey)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveOrder(orderKey: string, ids: string[]): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + orderKey, JSON.stringify(ids))
  } catch {
    // Storage full or unavailable — ordering just won't persist this time.
  }
}

/** Reorders `items` by the saved id sequence; unsaved items keep their order at the end. */
export function applySavedOrder<T extends { id: string }>(items: T[], orderKey: string): T[] {
  const saved = getSavedOrder(orderKey)
  if (saved.length === 0) {
    return items
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = saved.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
  const seen = new Set(saved)
  return [...ordered, ...items.filter((item) => !seen.has(item.id))]
}

export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
