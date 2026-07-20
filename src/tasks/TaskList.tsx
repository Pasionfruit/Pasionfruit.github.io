import { useMemo, useState } from 'react'
import { TaskRow } from './TaskRow'
import { buildTaskTree } from './grouping'
import { addDaysToKey, todayKey } from '../data/todoist/dates'
import type { TodoistTask } from '../data/todoist/types'
import type { TodoistStore } from './useTodoistData'

export type TaskListProps = {
  tasks: TodoistTask[]
  store: TodoistStore
  canEdit: boolean
  editingTaskId: string | null
  onEditToggle: (taskId: string | null) => void
  showDate?: boolean
  showProject?: boolean
  emptyMessage?: string
}

export function TaskList({
  tasks,
  store,
  canEdit,
  editingTaskId,
  onEditToggle,
  showDate = true,
  showProject = true,
  emptyMessage = 'Nothing here.',
}: TaskListProps) {
  // Scoped to this view's tasks — the store-wide subtask map would leak in
  // children that the current filter excluded.
  const { roots, childrenOf } = useMemo(() => buildTaskTree(tasks), [tasks])

  if (tasks.length === 0) {
    return <p className="tasks-empty">{emptyMessage}</p>
  }

  return (
    <div className="task-list">
      {roots.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          subtasks={childrenOf.get(task.id) ?? []}
          projectName={task.project_id ? store.projectsById.get(task.project_id)?.name : undefined}
          canEdit={canEdit}
          isWriting={store.isWriting}
          editingTaskId={editingTaskId}
          showDate={showDate}
          showProject={showProject}
          onEditToggle={onEditToggle}
          onComplete={store.complete}
          onSave={store.save}
          onReschedule={store.reschedule}
          onDelete={store.remove}
        />
      ))}
    </div>
  )
}

export type AddTaskFormProps = {
  store: TodoistStore
  canEdit: boolean
  defaultDueDate?: string
  defaultProjectId?: string
  defaultSectionId?: string
  label?: string
}

export function AddTaskForm({
  store,
  canEdit,
  defaultDueDate,
  defaultProjectId,
  defaultSectionId,
  label = 'Add task',
}: AddTaskFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [priority, setPriority] = useState(4)

  if (!canEdit) {
    return null
  }

  function reset() {
    setContent('')
    setDueDate(defaultDueDate ?? '')
    setPriority(4)
  }

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed) return

    const created = await store.create({
      content: trimmed,
      dueDate: dueDate || undefined,
      priority,
      projectId: defaultProjectId,
      sectionId: defaultSectionId,
    })

    if (created) {
      reset()
      setIsOpen(false)
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className="task-add-trigger" onClick={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> {label}
      </button>
    )
  }

  return (
    <form
      className="task-add-form"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <input
        className="task-input"
        value={content}
        autoFocus
        placeholder="Task name"
        aria-label="New task name"
        onChange={(event) => setContent(event.target.value)}
      />

      <div className="task-edit-row">
        <input
          className="task-input"
          type="date"
          value={dueDate}
          aria-label="New task due date"
          onChange={(event) => setDueDate(event.target.value)}
        />
        <select
          className="task-input"
          value={priority}
          aria-label="New task priority"
          onChange={(event) => setPriority(Number(event.target.value))}
        >
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
          <option value={4}>P4</option>
        </select>
      </div>

      <div className="task-edit-row">
        <button type="button" className="task-btn" onClick={() => setDueDate(todayKey())}>
          Today
        </button>
        <button type="button" className="task-btn" onClick={() => setDueDate(addDaysToKey(todayKey(), 1))}>
          Tomorrow
        </button>
      </div>

      <div className="task-edit-actions">
        <button type="submit" className="task-btn is-primary" disabled={store.isWriting || !content.trim()}>
          Add task
        </button>
        <button
          type="button"
          className="task-btn"
          onClick={() => {
            reset()
            setIsOpen(false)
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
