import { todoistRequest } from './client'
import { dueSortValue, todayKey } from './dates'
import type {
  TodoistProject,
  TodoistSection,
  TodoistTask,
  TodoistTaskDraft,
  TodoistTaskUpdate,
} from './types'

type TodoistTaskApi = {
  id: string | number
  parent_id?: string | null
  project_id?: string | number | null
  section_id?: string | number | null
  content: string
  description?: string
  labels?: string[]
  priority?: number
  is_completed?: boolean
  child_order?: number
  order?: number
  due?: {
    date?: string
    datetime?: string
    string?: string
    timezone?: string
    is_recurring?: boolean
  } | null
}

type TodoistProjectApi = {
  id: string | number
  name: string
  color?: string
  parent_id?: string | number | null
  child_order?: number
  order?: number
  is_favorite?: boolean
  is_inbox_project?: boolean
  inbox_project?: boolean
}

type TodoistSectionApi = {
  id: string | number
  project_id: string | number
  name: string
  section_order?: number
  order?: number
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

function optionalId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeTask(task: TodoistTaskApi): TodoistTask {
  return {
    id: String(task.id),
    parent_id: optionalId(task.parent_id),
    project_id: optionalId(task.project_id),
    section_id: optionalId(task.section_id),
    content: task.content,
    description: task.description ?? '',
    labels: task.labels ?? [],
    priority: mapPriorityFromApi(task.priority),
    is_completed: Boolean(task.is_completed),
    child_order: task.child_order ?? task.order ?? 0,
    due: task.due ?? null,
  }
}

function normalizeProject(project: TodoistProjectApi): TodoistProject {
  return {
    id: String(project.id),
    name: project.name,
    color: project.color,
    parent_id: optionalId(project.parent_id),
    child_order: project.child_order ?? project.order ?? 0,
    is_favorite: Boolean(project.is_favorite),
    is_inbox_project: Boolean(project.is_inbox_project ?? project.inbox_project),
  }
}

function normalizeSection(section: TodoistSectionApi): TodoistSection {
  return {
    id: String(section.id),
    project_id: String(section.project_id),
    name: section.name,
    section_order: section.section_order ?? section.order ?? 0,
  }
}

/**
 * Walks Todoist's cursor pagination. v1 returns `{results, next_cursor}`, but
 * bare arrays show up on some endpoints, so both shapes are handled.
 */
async function fetchAllPages<T>(path: string): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null

  do {
    const query = new URLSearchParams({ limit: '200' })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const separator = path.includes('?') ? '&' : '?'
    const response: T[] | TodoistListResponse<T> = await todoistRequest<T[] | TodoistListResponse<T>>(
      `${path}${separator}${query.toString()}`,
      { method: 'GET' },
    )

    if (Array.isArray(response)) {
      rows.push(...response)
      cursor = null
    } else {
      rows.push(...(response.results ?? []))
      cursor = response.next_cursor ?? null
    }
  } while (cursor)

  return rows
}

/** Every active (uncompleted) task, unfiltered. Views derive from this. */
export async function getActiveTasks(): Promise<TodoistTask[]> {
  const rows = await fetchAllPages<TodoistTaskApi>('/tasks')
  return rows.map(normalizeTask).sort((a, b) => dueSortValue(a) - dueSortValue(b))
}

export async function getProjects(): Promise<TodoistProject[]> {
  const rows = await fetchAllPages<TodoistProjectApi>('/projects')
  return rows.map(normalizeProject).sort((a, b) => {
    if (a.is_inbox_project !== b.is_inbox_project) {
      return a.is_inbox_project ? -1 : 1
    }
    return (a.child_order ?? 0) - (b.child_order ?? 0)
  })
}

export async function getSections(): Promise<TodoistSection[]> {
  const rows = await fetchAllPages<TodoistSectionApi>('/sections')
  return rows.map(normalizeSection).sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))
}

/**
 * Today + overdue, flattened for the home summary card.
 *
 * A due subtask nests under its parent only if that parent is also due today.
 * Otherwise the parent is just an organizational header with no due date of its
 * own (e.g. "Cats"), and the subtask would be silently dropped — so promote it
 * to top-level instead.
 */
export async function getTasksOfTheDay(): Promise<TodoistTask[]> {
  const allNormalized = await getActiveTasks()
  const today = todayKey()

  const isDueToday = (task: TodoistTask) => {
    const dueDate = task.due?.date ?? task.due?.datetime?.slice(0, 10)
    return Boolean(dueDate && dueDate <= today)
  }

  const dueTasks = allNormalized.filter(isDueToday)
  const dueIds = new Set(dueTasks.map((t) => t.id))

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

/** Create with full placement control (project/section), returning the new task. */
export async function createTaskDetailed(draft: TodoistTaskDraft): Promise<TodoistTask> {
  const created = await todoistRequest<TodoistTaskApi>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      content: draft.content,
      description: draft.description || undefined,
      due_date: draft.dueDate || undefined,
      priority: mapPriorityToApi(draft.priority ?? 1),
      parent_id: draft.parentId || undefined,
      project_id: draft.projectId || undefined,
      section_id: draft.sectionId || undefined,
    }),
  })

  return normalizeTask(created)
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

/** Reschedule only — leaves content, description and priority untouched. */
export async function rescheduleTask(taskId: string, dueDate: string) {
  await todoistRequest<unknown>(`/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ due_date: dueDate || null }),
  })
}

export async function closeTask(taskId: string) {
  await todoistRequest<unknown>(`/tasks/${taskId}/close`, {
    method: 'POST',
  })
}

export async function deleteTask(taskId: string) {
  await todoistRequest<unknown>(`/tasks/${taskId}`, {
    method: 'DELETE',
  })
}
