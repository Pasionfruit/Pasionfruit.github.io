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
}

export type TodoistTaskDraft = {
  content: string
  description?: string
  dueDate?: string
  priority?: number
  parentId?: string
  projectId?: string
  sectionId?: string
}
