import { useRef, useState } from 'react'
import { addDaysToKey, todayKey } from '../data/todoist/dates'
import type { TodoistStore } from './useTodoistData'

export type AddTaskFormProps = {
  store: TodoistStore
  canEdit: boolean
  defaultDueDate?: string
  defaultProjectId?: string
  defaultSectionId?: string
  /** Set when the new task is a subtask of this one. */
  parentId?: string
  label?: string
  /** Starts expanded instead of as a trigger button. */
  defaultOpen?: boolean
  /** Called after a cancel or Escape, for a parent that mounts the form on demand. */
  onClose?: () => void
  /** The task open in the editor; opening a different one closes this form. Leave unset for a subtask form, which its task closes. */
  editingTaskId?: string | null
}

export function AddTaskForm({
  store,
  canEdit,
  defaultDueDate,
  defaultProjectId,
  defaultSectionId,
  parentId,
  label = 'Add task',
  defaultOpen = false,
  onClose,
  editingTaskId = null,
}: AddTaskFormProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [priority, setPriority] = useState(4)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [seenEditingId, setSeenEditingId] = useState(editingTaskId)

  function reset() {
    setContent('')
    setDueDate(defaultDueDate ?? '')
    setPriority(4)
  }

  // Opening a task in the editor closes this form. Adjusting state while rendering, not in an
  // effect, so the form is already closed on the frame the click lands.
  if (editingTaskId !== seenEditingId) {
    setSeenEditingId(editingTaskId)
    if (editingTaskId) {
      reset()
      setIsOpen(false)
    }
  }

  function dismiss() {
    reset()
    setIsOpen(false)
    onClose?.()
  }

  if (!canEdit) {
    return null
  }

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || store.isWriting) return

    const created = await store.create({
      content: trimmed,
      dueDate: dueDate || undefined,
      priority,
      projectId: defaultProjectId,
      sectionId: defaultSectionId,
      parentId,
    })

    // Stay open for the next task: clear the name, keep the date and priority, and refocus.
    if (created) {
      setContent('')
      nameInputRef.current?.focus()
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
        ref={nameInputRef}
        className="task-input"
        value={content}
        autoFocus
        placeholder={parentId ? 'Subtask name' : 'Task name'}
        aria-label={parentId ? 'New subtask name' : 'New task name'}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') dismiss()
        }}
      />

      <div className="task-edit-row">
        <input
          className="task-input"
          type="date"
          value={dueDate}
          aria-label={parentId ? 'New subtask due date' : 'New task due date'}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <select
          className="task-input"
          value={priority}
          aria-label={parentId ? 'New subtask priority' : 'New task priority'}
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
          {parentId ? 'Add subtask' : 'Add task'}
        </button>
        <button type="button" className="task-btn" onClick={dismiss}>
          Cancel
        </button>
      </div>
    </form>
  )
}
