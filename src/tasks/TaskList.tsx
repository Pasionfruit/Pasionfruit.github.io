import { Fragment, useCallback, useMemo, useState } from 'react'
import { TaskRow } from './TaskRow'
import { buildTaskTree } from './grouping'
import { useTaskDrag } from './useTaskDrag'
import type { DropTarget } from './dropTarget'
import { getCollapsedIds, setTaskCollapsed } from './collapsedTasks'
import { applySavedOrder, arrayMove, saveOrder } from './taskOrder'
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
  /** Stable id for this list; enables hold-and-drag reordering when set. */
  orderKey?: string
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
  orderKey,
}: TaskListProps) {
  // Bumped after a drag so the memo re-reads the freshly saved order.
  const [orderVersion, setOrderVersion] = useState(0)

  // Scoped to this view's tasks — the store-wide subtask map would leak in
  // children that the current filter excluded.
  const { roots, childrenOf } = useMemo(() => {
    const tree = buildTaskTree(tasks)
    if (orderKey) {
      tree.roots = applySavedOrder(tree.roots, orderKey)
    }
    return tree
    // orderVersion is intentionally a dependency: it re-applies saved order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, orderKey, orderVersion])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  // Folded parents, read once from this device's storage; toggled per task.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => getCollapsedIds())
  const toggleCollapsed = useCallback(
    (taskId: string) => setCollapsedIds(setTaskCollapsed(taskId, !collapsedIds.has(taskId))),
    [collapsedIds],
  )

  const handleDrop = useCallback(
    (drop: DropTarget, taskId: string) => {
      const task = taskById.get(taskId)
      if (!task) return

      if (drop.kind === 'nest') {
        // Nesting takes the parent's project and section, as Todoist does.
        const parent = taskById.get(drop.parentId)
        if (!parent || parent.id === task.parent_id) return
        void store.move(taskId, {
          parentId: parent.id,
          projectId: parent.project_id ?? null,
          sectionId: parent.section_id ?? null,
        })
        return
      }

      if (task.parent_id) {
        // Lifting a subtask out: it becomes a top-level task at the drop slot.
        if (orderKey) {
          const ids = roots.map((root) => root.id)
          ids.splice(drop.index, 0, taskId)
          saveOrder(orderKey, ids)
          setOrderVersion((version) => version + 1)
        }
        void store.move(taskId, {
          parentId: null,
          projectId: task.project_id ?? null,
          sectionId: task.section_id ?? null,
        })
        return
      }

      // Reordering a top-level task. Without an orderKey the list has no saved order to change.
      if (!orderKey) return
      const from = roots.findIndex((root) => root.id === taskId)
      const to = drop.index > from ? drop.index - 1 : drop.index
      if (from < 0 || to === from) return
      saveOrder(orderKey, arrayMove(roots.map((root) => root.id), from, to))
      setOrderVersion((version) => version + 1)
    },
    [taskById, orderKey, roots, store],
  )

  const dragEnabled = canEdit
  const { containerRef, draggingId, drop, isDragging, handlers } = useTaskDrag({
    enabled: dragEnabled,
    hasChildren: (taskId) => (childrenOf.get(taskId)?.length ?? 0) > 0,
    onDrop: handleDrop,
  })

  if (tasks.length === 0) {
    return <p className="tasks-empty">{emptyMessage}</p>
  }

  // A subtask being dragged has no top-level slot, so it always shows every gap.
  const dragRootIndex = draggingId ? roots.findIndex((root) => root.id === draggingId) : -1
  const dragIsTopLevel = dragRootIndex >= 0
  const gapIndex = drop?.kind === 'gap' ? drop.index : null
  const nestTargetId = drop?.kind === 'nest' ? drop.parentId : null

  return (
    <div
      className={`task-list${isDragging ? ' is-reordering' : ''}`}
      ref={containerRef}
      {...(dragEnabled ? handlers : {})}
    >
      {roots.map((task, index) => {
        // Skip the drop line right where the dragged row already sits.
        const showDropLine =
          gapIndex === index && !(dragIsTopLevel && (dragRootIndex === index || dragRootIndex === index - 1))
        return (
          <Fragment key={task.id}>
            {showDropLine ? <div className="task-drop-line" aria-hidden="true" /> : null}
            <TaskRow
              task={task}
              subtasks={childrenOf.get(task.id) ?? []}
              projectName={task.project_id ? store.projectsById.get(task.project_id)?.name : undefined}
              canEdit={canEdit}
              isWriting={store.isWriting}
              editingTaskId={editingTaskId}
              showDate={showDate}
              showProject={showProject}
              canReorder={dragEnabled}
              rootIndex={index}
              draggingId={draggingId}
              nestTargetId={nestTargetId}
              isCollapsed={collapsedIds.has(task.id)}
              onToggleCollapsed={toggleCollapsed}
              onEditToggle={onEditToggle}
              onComplete={store.complete}
              onSave={store.save}
              onReschedule={store.reschedule}
              onDelete={store.remove}
            />
          </Fragment>
        )
      })}
      {gapIndex === roots.length && !(dragIsTopLevel && dragRootIndex === roots.length - 1) ? (
        <div className="task-drop-line" aria-hidden="true" />
      ) : null}
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
