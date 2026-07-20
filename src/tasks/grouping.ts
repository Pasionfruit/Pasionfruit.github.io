import { dueSortValue } from '../data/todoist/dates'
import type { TodoistTask } from '../data/todoist/types'

export type TaskTree = {
  roots: TodoistTask[]
  childrenOf: Map<string, TodoistTask[]>
}

/**
 * Builds a parent/child tree scoped to `tasks` only.
 *
 * A task is a root when its parent is absent from this set — either it has no
 * parent, or the parent is filtered out of the current view (an undated
 * organizational header like "Cats", say). Without this the subtask would
 * vanish, so it gets promoted instead.
 */
export function buildTaskTree(tasks: TodoistTask[]): TaskTree {
  const presentIds = new Set(tasks.map((task) => task.id))
  const roots: TodoistTask[] = []
  const childrenOf = new Map<string, TodoistTask[]>()

  for (const task of tasks) {
    if (task.parent_id && presentIds.has(task.parent_id)) {
      const bucket = childrenOf.get(task.parent_id)
      if (bucket) {
        bucket.push(task)
      } else {
        childrenOf.set(task.parent_id, [task])
      }
    } else {
      roots.push(task)
    }
  }

  const byDue = (a: TodoistTask, b: TodoistTask) => dueSortValue(a) - dueSortValue(b)
  roots.sort(byDue)
  for (const bucket of childrenOf.values()) {
    bucket.sort((a, b) => (a.child_order ?? 0) - (b.child_order ?? 0))
  }

  return { roots, childrenOf }
}

/** Priority first (P1 highest), then due date. Matches Todoist's default sort. */
export function sortByPriorityThenDue(tasks: TodoistTask[]): TodoistTask[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return dueSortValue(a) - dueSortValue(b)
  })
}
