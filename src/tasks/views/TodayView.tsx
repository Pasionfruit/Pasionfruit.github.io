import { useMemo } from 'react'
import { AddTaskForm, TaskList } from '../TaskList'
import { sortByPriorityThenDue } from '../grouping'
import { dueDateKey, formatDayLabel, todayKey } from '../../data/todoist/dates'
import type { TodoistStore } from '../useTodoistData'

export type ViewProps = {
  store: TodoistStore
  canEdit: boolean
  editingTaskId: string | null
  onEditToggle: (taskId: string | null) => void
}

export function TodayView({ store, canEdit, editingTaskId, onEditToggle }: ViewProps) {
  const today = todayKey()

  const { overdue, dueToday } = useMemo(() => {
    const overdueTasks = []
    const todayTasks = []

    for (const task of store.tasks) {
      const key = dueDateKey(task)
      if (!key) continue
      if (key < today) {
        overdueTasks.push(task)
      } else if (key === today) {
        todayTasks.push(task)
      }
    }

    return {
      overdue: sortByPriorityThenDue(overdueTasks),
      dueToday: sortByPriorityThenDue(todayTasks),
    }
  }, [store.tasks, today])

  function rescheduleAllOverdue() {
    for (const task of overdue) {
      void store.reschedule(task.id, today)
    }
  }

  return (
    <div className="tasks-view">
      {overdue.length > 0 ? (
        <section className="tasks-group">
          <header className="tasks-group-header">
            <h2>
              Overdue <span className="tasks-count">{overdue.length}</span>
            </h2>
            {canEdit ? (
              <button
                type="button"
                className="task-btn"
                disabled={store.isWriting}
                onClick={rescheduleAllOverdue}
              >
                Reschedule all to today
              </button>
            ) : null}
          </header>
          <TaskList
            tasks={overdue}
            store={store}
            canEdit={canEdit}
            editingTaskId={editingTaskId}
            onEditToggle={onEditToggle}
            orderKey="overdue"
          />
        </section>
      ) : null}

      <section className="tasks-group">
        <header className="tasks-group-header">
          <h2>
            Today <span className="tasks-subtle">{formatDayLabel(today)}</span>
            <span className="tasks-count">{dueToday.length}</span>
          </h2>
        </header>
        <TaskList
          tasks={dueToday}
          store={store}
          canEdit={canEdit}
          editingTaskId={editingTaskId}
          onEditToggle={onEditToggle}
          showDate={false}
          emptyMessage="Nothing due today. Enjoy it."
          orderKey="today"
        />
        <AddTaskForm store={store} canEdit={canEdit} defaultDueDate={today} />
      </section>
    </div>
  )
}
