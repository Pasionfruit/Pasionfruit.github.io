import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { TaskRow, type SiblingPosition } from './TaskRow'
import { buildTaskTree, descendantIds, MAX_TASK_LEVELS, subtreeHeight } from './grouping'
import { useTaskDrag } from './useTaskDrag'
import type { DropTarget } from './dropTarget'
import { getCollapsedIds, setTaskCollapsed } from './collapsedTasks'
import { applySavedOrder, arrayMove, saveOrder, subtaskOrderKey } from './taskOrder'
import type { TodoistTask } from '../data/todoist/types'
import type { TodoistStore } from './useTodoistData'

export { AddTaskForm } from './AddTaskForm'

export type TaskListProps = {
  tasks: TodoistTask[]
  store: TodoistStore
  canEdit: boolean
  editingTaskId: string | null
  onEditToggle: (taskId: string | null) => void
  showDate?: boolean
  showProject?: boolean
  emptyMessage?: string
  /** Stable id for this list; enables reordering top-level tasks when set. */
  orderKey?: string
}

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

function finePointerQuery() {
  return typeof window.matchMedia === 'function' ? window.matchMedia(FINE_POINTER_QUERY) : null
}

function subscribeFinePointer(onChange: () => void) {
  const query = finePointerQuery()
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True on a mouse or trackpad. Drag reordering is for those; touch screens use the arrows. */
function useFinePointer() {
  return useSyncExternalStore(
    subscribeFinePointer,
    () => finePointerQuery()?.matches ?? true,
    () => true,
  )
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
  // Bumped after a drag or an arrow move so the memo re-reads the freshly saved order.
  const [orderVersion, setOrderVersion] = useState(0)

  // Scoped to this view's tasks — the store-wide subtask map would leak in
  // children that the current filter excluded.
  const { roots, childrenOf } = useMemo(() => {
    const tree = buildTaskTree(tasks)
    if (orderKey) {
      tree.roots = applySavedOrder(tree.roots, orderKey)
    }
    // Each parent keeps its own subtask order, saved on this device, whichever list shows it.
    for (const parentId of [...tree.childrenOf.keys()]) {
      tree.childrenOf.set(parentId, applySavedOrder(tree.childrenOf.get(parentId) ?? [], subtaskOrderKey(parentId)))
    }
    return tree
    // orderVersion is intentionally a dependency: it re-applies saved order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, orderKey, orderVersion])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  // Where each task sits among its siblings. Top-level tasks only count when the list has an
  // order to save, so a list without one shows no move arrows at the top level.
  const positions = useMemo(() => {
    const map = new Map<string, SiblingPosition>()
    const place = (siblings: TodoistTask[]) =>
      siblings.forEach((task, index) => map.set(task.id, { index, count: siblings.length }))
    if (orderKey) place(roots)
    for (const siblings of childrenOf.values()) place(siblings)
    return map
  }, [roots, childrenOf, orderKey])

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

      if (drop.kind === 'sibling') {
        const siblingIds = (childrenOf.get(drop.parentId) ?? [])
          .map((sibling) => sibling.id)
          .filter((id) => id !== taskId)
        siblingIds.splice(drop.index, 0, taskId)
        saveOrder(subtaskOrderKey(drop.parentId), siblingIds)
        setOrderVersion((version) => version + 1)
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
    [taskById, orderKey, roots, childrenOf, store],
  )

  /** Swaps a task with its neighbour among its siblings, and saves the new order on this device. */
  const moveTask = useCallback(
    (taskId: string, delta: -1 | 1) => {
      const position = positions.get(taskId)
      if (!position) return
      const isTopLevel = roots.some((root) => root.id === taskId)
      const parentId = taskById.get(taskId)?.parent_id ?? ''
      const siblings = isTopLevel ? roots : (childrenOf.get(parentId) ?? [])
      const next = arrayMove(
        siblings.map((sibling) => sibling.id),
        position.index,
        position.index + delta,
      )

      if (isTopLevel) {
        if (!orderKey) return
        saveOrder(orderKey, next)
      } else {
        saveOrder(subtaskOrderKey(parentId), next)
      }
      setOrderVersion((version) => version + 1)
    },
    [positions, roots, childrenOf, taskById, orderKey],
  )

  // A task may nest under a visible task only if it stays inside the level limit and
  // is not being dropped into its own subtree.
  const canNestUnder = useCallback(
    (draggingId: string, targetId: string, targetDepth: number) => {
      if (descendantIds(draggingId, childrenOf).has(targetId)) return false
      return targetDepth + 1 + subtreeHeight(draggingId, childrenOf) <= MAX_TASK_LEVELS - 1
    },
    [childrenOf],
  )

  /** Files a task into a project as a top-level task, the way a move from the Inbox would. */
  const handleMoveToProject = useCallback(
    (taskId: string, projectId: string) => {
      void store.move(taskId, { parentId: null, projectId, sectionId: null })
    },
    [store],
  )

  // Drag is for mouse and trackpad only; on touch the arrows do the job.
  const isFinePointer = useFinePointer()
  const dragEnabled = canEdit && isFinePointer
  const { containerRef, draggingId, drop, isDragging, handlers } = useTaskDrag({
    enabled: dragEnabled,
    canNestUnder,
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
  const siblingDrop = drop?.kind === 'sibling' ? drop : null

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
              childrenOf={childrenOf}
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
              siblingDrop={siblingDrop}
              positions={positions}
              onMove={canEdit ? moveTask : undefined}
              collapsedIds={collapsedIds}
              onToggleCollapsed={toggleCollapsed}
              onEditToggle={onEditToggle}
              onComplete={store.complete}
              onSave={store.save}
              onReschedule={store.reschedule}
              onDelete={store.remove}
              projects={store.projects}
              onMoveToProject={handleMoveToProject}
              store={store}
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
