import { todoistRequest } from './client'
import type { TodoistTask, TodoistTaskUpdate } from './types'

type TodoistTaskApi = {
  id: string | number
  parent_id?: string | null
  content: string
  description?: string
  priority?: number
  is_completed?: boolean
  due?: {
    date?: string
    datetime?: string
    string?: string
    timezone?: string
  } | null
}

type TodoistListResponse<T> = {
  results: T[]
  next_cursor?: string | null
}

function clampPriority(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(4, Math.max(1, Math.round(value)))
}

function mapPriorityFromApi(priority?: number) {
  const normalized = clampPriority(priority ?? 1)
  return 5 - normalized
}

function mapPriorityToApi(priority: number) {
  const normalized = clampPriority(priority)
  return 5 - normalized
}

function normalizeTask(task: TodoistTaskApi): TodoistTask {
  return {
    id: String(task.id),
    parent_id: task.parent_id ?? null,
    content: task.content,
    description: task.description ?? '',
    priority: mapPriorityFromApi(task.priority),
    is_completed: Boolean(task.is_completed),
    due: task.due ?? null,
  }
}

function dueSortValue(task: TodoistTask) {
  const value = task.due?.datetime ?? task.due?.date
  if (!value) {
    return Number.MAX_SAFE_INTEGER
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

export async function getTasksOfTheDay(): Promise<TodoistTask[]> {
  const rows: TodoistTaskApi[] = []
  let cursor: string | null = null

  do {
    const query = new URLSearchParams({ limit: '200' })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const response = await todoistRequest<TodoistTaskApi[] | TodoistListResponse<TodoistTaskApi>>(
      `/tasks?${query.toString()}`,
      {
        method: 'GET',
      },
    )

    if (Array.isArray(response)) {
      rows.push(...response)
      cursor = null
    } else {
      rows.push(...(response.results ?? []))
      cursor = response.next_cursor ?? null
    }
  } while (cursor)

  const todayKey = new Date().toISOString().slice(0, 10)
  const allNormalized = rows.map(normalizeTask)

  const isDueToday = (task: TodoistTask) => {
    const dueDate = task.due?.date ?? task.due?.datetime?.slice(0, 10)
    return Boolean(dueDate && dueDate <= todayKey)
  }

  const dueTasks = allNormalized.filter(isDueToday)
  const dueIds = new Set(dueTasks.map((t) => t.id))

  // A due subtask nests under its parent only if that parent is also due
  // today. Otherwise the parent is just an organizational header with no
  // due date of its own (e.g. "Cats"), and the subtask would be silently
  // dropped — so promote it to top-level instead.
  const primaryTasks = dueTasks
    .filter((task) => !task.parent_id || !dueIds.has(task.parent_id))
    .map((task) => (task.parent_id ? { ...task, parent_id: null } : task))

  const subtasks = dueTasks.filter((task) => task.parent_id && dueIds.has(task.parent_id))

  return [...primaryTasks.sort((a, b) => dueSortValue(a) - dueSortValue(b)), ...subtasks]
}

export async function createTask(content: string, dueDate?: string, priority = 1, parentId?: string) {
  await todoistRequest<unknown>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      content,
      due_date: dueDate || undefined,
      priority: mapPriorityToApi(priority),
      parent_id: parentId || undefined,
    }),
  })
}

export async function updateTask(taskId: string, update: TodoistTaskUpdate) {
  await todoistRequest<unknown>(`/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({
      content: update.content,
      description: update.description ?? '',
      due_date: update.dueDate || null,
      priority: mapPriorityToApi(update.priority),
    }),
  })
}

export async function closeTask(taskId: string) {
  await todoistRequest<unknown>(`/tasks/${taskId}/close`, {
    method: 'POST',
  })
}
