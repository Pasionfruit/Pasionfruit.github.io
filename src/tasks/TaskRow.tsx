import { useState } from 'react'
import { addDaysToKey, dueDateKey, dueTimeLabel, formatDayLabel, isOverdue, todayKey } from '../data/todoist/dates'
import type { TodoistTask, TodoistTaskUpdate } from '../data/todoist/types'

function normalizePriority(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(4, Math.max(1, Math.round(value)))
}

/**
 * The inline editor is a separate component mounted only while editing and keyed
 * on the task id, so its draft state seeds from the task exactly once on mount —
 * no re-seeding effect, and a fresh task always gets a fresh draft.
 */
function TaskEditForm({
  task,
  isWriting,
  onSave,
  onCancel,
  onDelete,
}: {
  task: TodoistTask
  isWriting: boolean
  onSave: (taskId: string, update: TodoistTaskUpdate) => void
  onCancel: () => void
  onDelete: (taskId: string) => void
}) {
  const [content, setContent] = useState(task.content)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(dueDateKey(task))
  const [priority, setPriority] = useState(normalizePriority(task.priority))

  function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed) return
    onSave(task.id, {
      content: trimmed,
      description: description.trim(),
      dueDate: dueDate || undefined,
      priority,
    })
  }

  return (
    <form
      className="task-edit"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <input
        className="task-input"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Task name"
        aria-label="Task name"
      />
      <input
        className="task-input"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        aria-label="Task description"
      />

      <div className="task-edit-row">
        <input
          className="task-input"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Due date"
        />
        <select
          className="task-input"
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value))}
          aria-label="Priority"
        >
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
          <option value={4}>P4</option>
        </select>
      </div>

      <div className="task-edit-row">
        <button type="button" className="task-btn" disabled={isWriting} onClick={() => setDueDate(todayKey())}>
          Today
        </button>
        <button
          type="button"
          className="task-btn"
          disabled={isWriting}
          onClick={() => setDueDate(addDaysToKey(todayKey(), 1))}
        >
          Tomorrow
        </button>
        <button
          type="button"
          className="task-btn"
          disabled={isWriting}
          onClick={() => setDueDate(addDaysToKey(todayKey(), 7))}
        >
          Next week
        </button>
      </div>

      <div className="task-edit-actions">
        <button type="submit" className="task-btn is-primary" disabled={isWriting || !content.trim()}>
          Save
        </button>
        <button type="button" className="task-btn" disabled={isWriting} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="task-btn is-danger" disabled={isWriting} onClick={() => onDelete(task.id)}>
          Delete
        </button>
      </div>
    </form>
  )
}

export type TaskRowProps = {
  task: TodoistTask
  subtasks?: TodoistTask[]
  projectName?: string
  canEdit: boolean
  isWriting: boolean
  editingTaskId: string | null
  showDate?: boolean
  showProject?: boolean
  depth?: number
  onEditToggle: (taskId: string | null) => void
  onComplete: (taskId: string) => void
  onSave: (taskId: string, update: TodoistTaskUpdate) => void
  onReschedule: (taskId: string, dueDate: string) => void
  onDelete: (taskId: string) => void
}

export function TaskRow({
  task,
  subtasks = [],
  projectName,
  canEdit,
  isWriting,
  editingTaskId,
  showDate = true,
  showProject = true,
  depth = 0,
  onEditToggle,
  onComplete,
  onSave,
  onReschedule,
  onDelete,
}: TaskRowProps) {
  const isEditing = editingTaskId === task.id
  const dayKey = dueDateKey(task)
  const overdue = isOverdue(task)
  const timeLabel = dueTimeLabel(task)
  const priorityValue = normalizePriority(task.priority)

  return (
    <div className="task-item" data-depth={depth}>
      <div className={`task-row${isEditing ? ' is-editing' : ''}`} data-priority={priorityValue}>
        <button
          type="button"
          className="task-check"
          data-priority={priorityValue}
          aria-label={`Complete ${task.content}`}
          disabled={!canEdit || isWriting}
          onClick={() => onComplete(task.id)}
        />

        <div
          className="task-body"
          role={canEdit ? 'button' : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={() => canEdit && onEditToggle(isEditing ? null : task.id)}
          onKeyDown={(event) => {
            if (!canEdit) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onEditToggle(isEditing ? null : task.id)
            }
          }}
        >
          <p className="task-title">{task.content}</p>
          {task.description ? <p className="task-desc">{task.description}</p> : null}

          <div className="task-meta">
            {showDate && dayKey ? (
              <span className={`task-chip task-date${overdue ? ' is-overdue' : ''}`}>
                {formatDayLabel(dayKey)}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </span>
            ) : null}
            {task.due?.is_recurring ? <span className="task-chip task-recurring">↻</span> : null}
            {showProject && projectName ? <span className="task-chip task-project">{projectName}</span> : null}
            {(task.labels ?? []).map((label) => (
              <span key={label} className="task-chip task-label">
                @{label}
              </span>
            ))}
          </div>
        </div>

        {canEdit && overdue ? (
          <button
            type="button"
            className="task-quick-action"
            aria-label="Reschedule to today"
            title="Reschedule to today"
            disabled={isWriting}
            onClick={() => onReschedule(task.id, todayKey())}
          >
            Today
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <TaskEditForm
          key={task.id}
          task={task}
          isWriting={isWriting}
          onSave={onSave}
          onCancel={() => onEditToggle(null)}
          onDelete={onDelete}
        />
      ) : null}

      {subtasks.length > 0 ? (
        <div className="task-subtasks">
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              projectName={projectName}
              canEdit={canEdit}
              isWriting={isWriting}
              editingTaskId={editingTaskId}
              showDate={showDate}
              showProject={false}
              depth={depth + 1}
              onEditToggle={onEditToggle}
              onComplete={onComplete}
              onSave={onSave}
              onReschedule={onReschedule}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
