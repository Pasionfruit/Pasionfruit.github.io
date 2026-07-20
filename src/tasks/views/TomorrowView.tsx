import { useMemo } from 'react'
import { AddTaskForm, TaskList } from '../TaskList'
import { sortByPriorityThenDue } from '../grouping'
import { dueDateKey, formatDayLabel, tomorrowKey } from '../../data/todoist/dates'
import type { ViewProps } from './TodayView'

export function TomorrowView({ store, canEdit, editingTaskId, onEditToggle }: ViewProps) {
  const tomorrow = tomorrowKey()

  const tasks = useMemo(
    () => sortByPriorityThenDue(store.tasks.filter((task) => dueDateKey(task) === tomorrow)),
    [store.tasks, tomorrow],
  )

  return (
    <div className="tasks-view">
      <section className="tasks-group">
        <header className="tasks-group-header">
          <h2>
            Tomorrow <span className="tasks-subtle">{formatDayLabel(tomorrow)}</span>
            <span className="tasks-count">{tasks.length}</span>
          </h2>
        </header>
        <TaskList
          tasks={tasks}
          store={store}
          canEdit={canEdit}
          editingTaskId={editingTaskId}
          onEditToggle={onEditToggle}
          showDate={false}
          emptyMessage="Nothing scheduled for tomorrow yet."
        />
        <AddTaskForm store={store} canEdit={canEdit} defaultDueDate={tomorrow} />
      </section>
    </div>
  )
}
