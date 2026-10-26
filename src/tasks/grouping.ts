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

/**
 * A day view's tasks as a flat list: each task once, with no parent. A subtask due that day
 * shows on its own, as it does on the home card, instead of nesting under a parent that is
 * also due (which would list it twice over the card's count).
 */
export function flatDayTasks(tasks: TodoistTask[]): TodoistTask[] {
  const seen = new Set<string>()
  const flat: TodoistTask[] = []
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    flat.push(task.parent_id ? { ...task, parent_id: null } : task)
  }
  return flat
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

/**
 * The section a task belongs to on the Projects view. A subtask follows its
 * parent, so it stays under the parent's section even when Todoist leaves its
 * own section empty. Parents missing from `byId` count as absent.
 */
export function inheritedSectionId(task: TodoistTask, byId: Map<string, TodoistTask>): string | null {
  let current = task
  const seen = new Set<string>()
  while (current.parent_id && byId.has(current.parent_id) && !seen.has(current.id)) {
    seen.add(current.id)
    current = byId.get(current.parent_id) as TodoistTask
  }
  return current.section_id ?? null
}

/**
 * How many task levels a list may show, top level included. Todoist's own limit
 * is not documented in the API, so this is ours: nesting past it is refused.
 */
export const MAX_TASK_LEVELS = 4

/** Ids of every task below `taskId` in `childrenOf`, not including it. */
export function descendantIds(taskId: string, childrenOf: Map<string, TodoistTask[]>): Set<string> {
  const found = new Set<string>()
  const stack = [...(childrenOf.get(taskId) ?? [])]
  while (stack.length > 0) {
    const child = stack.pop() as TodoistTask
    if (found.has(child.id)) continue
    found.add(child.id)
    stack.push(...(childrenOf.get(child.id) ?? []))
  }
  return found
}

/** Levels below `taskId`: 0 for a task without subtasks, 1 for a task whose subtasks have none, and so on. */
export function subtreeHeight(taskId: string, childrenOf: Map<string, TodoistTask[]>): number {
  const children = childrenOf.get(taskId) ?? []
  let deepest = 0
  for (const child of children) {
    deepest = Math.max(deepest, 1 + subtreeHeight(child.id, childrenOf))
  }
  return deepest
}

/**
 * `matched` plus every ancestor of them, so a parent with a matching subtask
 * still shows in a date view even when the parent has no date itself.
 */
export function withAncestors(all: TodoistTask[], matched: TodoistTask[]): TodoistTask[] {
  const byId = new Map(all.map((task) => [task.id, task]))
  const kept = new Map<string, TodoistTask>()
  for (const task of matched) {
    kept.set(task.id, task)
    const seen = new Set<string>([task.id])
    let parent = task.parent_id ? byId.get(task.parent_id) : undefined
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      kept.set(parent.id, parent)
      parent = parent.parent_id ? byId.get(parent.parent_id) : undefined
    }
  }
  return [...kept.values()]
}
