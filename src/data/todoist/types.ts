import type { Recurrence } from './recurrence'

export type TodoistDue = {
  date?: string
  datetime?: string
  string?: string
  timezone?: string
  is_recurring?: boolean
}

export type TodoistTask = {
  id: string
  parent_id?: string | null
  project_id?: string | null
  section_id?: string | null
  content: string
  description?: string
  labels?: string[]
  priority: number
  is_completed: boolean
  child_order?: number
  due?: TodoistDue | null
}

export type TodoistProject = {
  id: string
  name: string
  color?: string
  parent_id?: string | null
  child_order?: number
  is_favorite?: boolean
  is_inbox_project?: boolean
}

export type TodoistSection = {
  id: string
  project_id: string
  name: string
  section_order?: number
}

export type TodoistTaskUpdate = {
  content: string
  description?: string
  dueDate?: string
  priority: number
  /** Omit to leave repeating as it is; null to stop repeating. */
  repeat?: Recurrence | null
  /** The task's current repeat string, resent with a new date so the repeat keeps its schedule. */
  dueString?: string
}

/**
 * Where a task goes. With a parent it becomes that task's subtask (the project
 * and section are the parent's). Without one it becomes a top-level task in
 * the given section, or in the project when there is no section.
 */
export type TodoistTaskDestination = {
  parentId: string | null
  projectId: string | null
  sectionId: string | null
}

export type TodoistTaskDraft = {
  content: string
  description?: string
  dueDate?: string
  /** Repeats from the due date; needs one. */
  repeat?: Recurrence | null
  priority?: number
  parentId?: string
  projectId?: string
  sectionId?: string
}
