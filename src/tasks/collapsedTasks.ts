// Which tasks have their subtasks folded away. Per device, like the saved order
// in taskOrder.ts: a view preference, not task data.

const KEY = 'todoist-collapsed'

export function getCollapsedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function setTaskCollapsed(taskId: string, collapsed: boolean): Set<string> {
  const next = getCollapsedIds()
  if (collapsed) {
    next.add(taskId)
  } else {
    next.delete(taskId)
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // Storage full or unavailable — the fold just won't persist this time.
  }
  return next
}
