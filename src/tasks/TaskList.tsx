import { Fragment, useCallback, useMemo, useState } from 'react'
import { TaskRow, type SiblingPosition } from './TaskRow'
import { buildTaskTree } from './grouping'
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
  /** Stable id for this list; enables moving top-level tasks when set. */
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
  // Bumped after a move so the memo re-reads the freshly saved order.
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

  /** Files a task into a project as a top-level task, the way a move from the Inbox would. */
  const handleMoveToProject = useCallback(
    (taskId: string, projectId: string) => {
      void store.move(taskId, { parentId: null, projectId, sectionId: null })
    },
    [store],
  )

  if (tasks.length === 0) {
    return <p className="tasks-empty">{emptyMessage}</p>
  }

  return (
    <div className="task-list">
      {roots.map((task) => (
        <Fragment key={task.id}>
          <TaskRow
            task={task}
            childrenOf={childrenOf}
            projectName={task.project_id ? store.projectsById.get(task.project_id)?.name : undefined}
            canEdit={canEdit}
            isWriting={store.isWriting}
            editingTaskId={editingTaskId}
            showDate={showDate}
            showProject={showProject}
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
      ))}
    </div>
  )
}
