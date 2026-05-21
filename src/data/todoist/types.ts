export type TodoistDue = {
  date?: string
  datetime?: string
  string?: string
  timezone?: string
}

export type TodoistTask = {
  id: string
  content: string
  priority: number
  is_completed: boolean
  due?: TodoistDue | null
}

export type TodoistTaskUpdate = {
  content: string
  dueDate?: string
  priority: number
}
