import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, GripVertical, RotateCw, Trash2 } from 'lucide-react'
import { addDaysToKey, dueDateKey, dueTimeLabel, formatDayLabel, isOverdue, todayKey } from '../data/todoist/dates'
import type { TodoistProject, TodoistTask, TodoistTaskUpdate } from '../data/todoist/types'
import { AddTaskForm } from './AddTaskForm'
import { MAX_TASK_LEVELS } from './grouping'
import type { TodoistStore } from './useTodoistData'
import { recurrenceFromDraft, repeatDraftFor } from '../data/todoist/recurrence'
import { RepeatControls } from './RepeatControls'

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
  projects,
  onMoveToProject,
  onAddSubtask,
}: {
  task: TodoistTask
  isWriting: boolean
  onSave: (taskId: string, update: TodoistTaskUpdate) => void
  onCancel: () => void
  onDelete: (taskId: string) => void
  projects: TodoistProject[]
  onMoveToProject?: (taskId: string, projectId: string) => void
  /** Shown only when the task can take another level of subtasks. */
  onAddSubtask?: () => void
}) {
  const [content, setContent] = useState(task.content)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(dueDateKey(task))
  const [priority, setPriority] = useState(normalizePriority(task.priority))
  const [repeat, setRepeat] = useState(() => repeatDraftFor(task.due?.string, Boolean(task.due?.is_recurring)))

  function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed) return
    onSave(task.id, {
      content: trimmed,
      description: description.trim(),
      dueDate: dueDate || undefined,
      priority,
      repeat: recurrenceFromDraft(repeat, Boolean(dueDate)),
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

      <RepeatControls draft={repeat} onChange={setRepeat} canRepeat={Boolean(dueDate)} disabled={isWriting} />

      {projects.length > 0 && onMoveToProject ? (
        <div className="task-edit-row">
          <select
            className="task-input"
            value={task.project_id ?? ''}
            disabled={isWriting}
            onChange={(event) => onMoveToProject(task.id, event.target.value)}
            aria-label="Project"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.is_inbox_project ? `${project.name} (Inbox)` : project.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
        {onAddSubtask ? (
          <button type="button" className="task-btn" disabled={isWriting} onClick={onAddSubtask}>
            Add subtask
          </button>
        ) : null}
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
  /** Every task's subtasks in this list, so the tree renders to any depth. */
  childrenOf?: Map<string, TodoistTask[]>
  projectName?: string
  canEdit: boolean
  isWriting: boolean
  editingTaskId: string | null
  showDate?: boolean
  showProject?: boolean
  depth?: number
  canReorder?: boolean
  /** Position among the top-level tasks; set only on those, so the drag code can find drop slots. */
  rootIndex?: number
  /** The task being dragged, and the task a drag would nest under. */
  draggingId?: string | null
  nestTargetId?: string | null
  /** Where a dragged subtask would land among this task's subtasks, when it is in this block. */
  siblingDrop?: { parentId: string; index: number } | null
  /** Task ids whose subtasks are folded away. */
  collapsedIds?: Set<string>
  onToggleCollapsed?: (taskId: string) => void
  onEditToggle: (taskId: string | null) => void
  onComplete: (taskId: string) => void
  onSave: (taskId: string, update: TodoistTaskUpdate) => void
  onReschedule: (taskId: string, dueDate: string) => void
  onDelete: (taskId: string) => void
  /** Projects the editor can file the task into; the Inbox is one of them. */
  projects?: TodoistProject[]
  onMoveToProject?: (taskId: string, projectId: string) => void
  /** Needed to create subtasks from the editor. */
  store?: TodoistStore
}

export function TaskRow({
  task,
  childrenOf,
  projectName,
  canEdit,
  isWriting,
  editingTaskId,
  showDate = true,
  showProject = true,
  depth = 0,
  canReorder = false,
  rootIndex,
  draggingId = null,
  nestTargetId = null,
  siblingDrop = null,
  collapsedIds,
  onToggleCollapsed,
  onEditToggle,
  onComplete,
  onSave,
  onReschedule,
  onDelete,
  projects = [],
  onMoveToProject,
  store,
}: TaskRowProps) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  // Opening any task in the editor closes this task's subtask form.
  const [seenEditingId, setSeenEditingId] = useState(editingTaskId)
  if (editingTaskId !== seenEditingId) {
    setSeenEditingId(editingTaskId)
    if (editingTaskId) setIsAddingSubtask(false)
  }
  const isEditing = editingTaskId === task.id
  const isDragging = draggingId === task.id
  const isNestTarget = nestTargetId === task.id
  const dayKey = dueDateKey(task)
  // A subtask sits one level below this task, so this task must leave room for it.
  const canAddSubtask = canEdit && store !== undefined && depth + 1 < MAX_TASK_LEVELS
  const overdue = isOverdue(task)
  const timeLabel = dueTimeLabel(task)
  const priorityValue = normalizePriority(task.priority)
  const subtasks = childrenOf?.get(task.id) ?? []
  const hasSubtasks = subtasks.length > 0
  const isCollapsed = collapsedIds?.has(task.id) ?? false
  // The drop line falls before the subtask at the slot, counting the dragged subtask out.
  const visibleSubtasks = subtasks.filter((subtask) => subtask.id !== draggingId)
  const slot = siblingDrop && siblingDrop.parentId === task.id ? siblingDrop.index : -1
  const lineBeforeId = slot >= 0 && slot < visibleSubtasks.length ? visibleSubtasks[slot].id : null
  const lineAtEnd = slot >= 0 && slot >= visibleSubtasks.length

  return (
    <div
      className={`task-item${isDragging ? ' is-dragging' : ''}`}
      data-depth={depth}
      data-task-id={task.id}
      data-parent-id={task.parent_id ?? undefined}
      data-root-index={rootIndex}
    >
      <div
        className={`task-row${isEditing ? ' is-editing' : ''}${isNestTarget ? ' is-nest-target' : ''}`}
        data-priority={priorityValue}
      >
        {canReorder ? (
          <span className="task-drag-handle" aria-hidden="true" title="Drag to move or nest">
            <GripVertical size={15} />
          </span>
        ) : null}
        {!(hasSubtasks && onToggleCollapsed) ? <span className="task-collapse-spacer" aria-hidden="true" /> : null}
        {hasSubtasks && onToggleCollapsed ? (
          <button
            type="button"
            className="task-collapse"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} subtasks of ${task.content}`}
            title={isCollapsed ? 'Show subtasks' : 'Hide subtasks'}
            onClick={() => onToggleCollapsed(task.id)}
          >
            {isCollapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        ) : null}
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
            {hasSubtasks && isCollapsed ? (
              <span className="task-chip task-subcount">
                {subtasks.length} subtask{subtasks.length === 1 ? '' : 's'}
              </span>
            ) : null}
            {task.due?.is_recurring ? (
              <span className="task-chip task-recurring" title="Recurring">
                <RotateCw size={11} aria-hidden="true" />
              </span>
            ) : null}
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

        {canEdit ? (
          <button
            type="button"
            className="task-delete"
            aria-label={`Delete ${task.content}`}
            title="Delete task"
            disabled={isWriting}
            onClick={() => onDelete(task.id)}
          >
            <Trash2 size={15} aria-hidden="true" />
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
          projects={projects}
          onMoveToProject={onMoveToProject}
          onAddSubtask={
            canAddSubtask
              ? () => {
                  onEditToggle(null)
                  setIsAddingSubtask(true)
                }
              : undefined
          }
        />
      ) : null}

      {isAddingSubtask && store ? (
        <div className="task-subtask-add">
          <AddTaskForm
            store={store}
            canEdit={canEdit}
            parentId={task.id}
            defaultDueDate={dayKey ?? undefined}
            defaultProjectId={task.project_id ?? undefined}
            defaultSectionId={task.section_id ?? undefined}
            defaultOpen
            onClose={() => setIsAddingSubtask(false)}
          />
        </div>
      ) : null}

      {hasSubtasks && !isCollapsed ? (
        <div className="task-subtasks">
          {subtasks.map((subtask) => (
            <Fragment key={subtask.id}>
              {lineBeforeId === subtask.id ? <div className="task-drop-line" aria-hidden="true" /> : null}
              <TaskRow
                task={subtask}
                childrenOf={childrenOf}
                collapsedIds={collapsedIds}
                onToggleCollapsed={onToggleCollapsed}
                projectName={projectName}
                canEdit={canEdit}
                isWriting={isWriting}
                editingTaskId={editingTaskId}
                showDate={showDate}
                showProject={false}
                depth={depth + 1}
                canReorder={canReorder}
                draggingId={draggingId}
                nestTargetId={nestTargetId}
                siblingDrop={siblingDrop}
                onEditToggle={onEditToggle}
                onComplete={onComplete}
                onSave={onSave}
                onReschedule={onReschedule}
                onDelete={onDelete}
                projects={projects}
                onMoveToProject={onMoveToProject}
                store={store}
              />
            </Fragment>
          ))}
          {lineAtEnd ? <div className="task-drop-line" aria-hidden="true" /> : null}
        </div>
      ) : null}
    </div>
  )
}
