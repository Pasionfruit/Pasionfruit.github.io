import { useMemo, useState } from 'react'
import { AddTaskForm, TaskList } from '../TaskList'
import { sortByPriorityThenDue } from '../grouping'
import {
  dateFromKey,
  dueDateKey,
  formatDayLabel,
  toLocalDateKey,
  todayKey,
} from '../../data/todoist/dates'
import type { TodoistTask } from '../../data/todoist/types'
import type { ViewProps } from './TodayView'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 42 cells — six weeks starting from the Sunday on or before the 1st. */
function buildMonthGrid(year: number, month: number): string[] {
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(day.getDate() + index)
    return toLocalDateKey(day)
  })
}

export function UpcomingView({ store, canEdit, editingTaskId, onEditToggle }: ViewProps) {
  const today = todayKey()
  const [selectedDay, setSelectedDay] = useState(today)
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = dateFromKey(today)
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TodoistTask[]>()
    for (const task of store.tasks) {
      const key = dueDateKey(task)
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(task)
      } else {
        map.set(key, [task])
      }
    }
    return map
  }, [store.tasks])

  const grid = useMemo(
    () => buildMonthGrid(monthCursor.year, monthCursor.month),
    [monthCursor],
  )

  const selectedTasks = useMemo(
    () => sortByPriorityThenDue(tasksByDay.get(selectedDay) ?? []),
    [tasksByDay, selectedDay],
  )

  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(delta: number) {
    setMonthCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function jumpToToday() {
    const now = dateFromKey(today)
    setMonthCursor({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDay(today)
  }

  return (
    <div className="tasks-view">
      <section className="tasks-calendar">
        <header className="tasks-calendar-header">
          <button type="button" className="task-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            ‹
          </button>
          <h2>{monthLabel}</h2>
          <button type="button" className="task-btn" aria-label="Next month" onClick={() => shiftMonth(1)}>
            ›
          </button>
          <button type="button" className="task-btn" onClick={jumpToToday}>
            Today
          </button>
        </header>

        <div className="tasks-calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="tasks-calendar-grid" role="grid" aria-label={`Tasks for ${monthLabel}`}>
          {grid.map((dayKey) => {
            const dayTasks = tasksByDay.get(dayKey) ?? []
            const date = dateFromKey(dayKey)
            const inMonth = date.getMonth() === monthCursor.month
            const overdue = dayKey < today && dayTasks.length > 0
            const topPriority = dayTasks.reduce((best, task) => Math.min(best, task.priority), 4)

            return (
              <button
                key={dayKey}
                type="button"
                role="gridcell"
                className={[
                  'tasks-calendar-day',
                  inMonth ? '' : 'is-outside',
                  dayKey === today ? 'is-today' : '',
                  dayKey === selectedDay ? 'is-selected' : '',
                  overdue ? 'is-overdue' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${formatDayLabel(dayKey)} — ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                aria-selected={dayKey === selectedDay}
                onClick={() => setSelectedDay(dayKey)}
              >
                <span className="tasks-calendar-daynum">{date.getDate()}</span>
                {dayTasks.length > 0 ? (
                  <span className="tasks-calendar-dot" data-priority={topPriority}>
                    {dayTasks.length}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      <section className="tasks-group">
        <header className="tasks-group-header">
          <h2>
            {formatDayLabel(selectedDay)}
            <span className="tasks-count">{selectedTasks.length}</span>
          </h2>
        </header>
        <TaskList
          tasks={selectedTasks}
          store={store}
          canEdit={canEdit}
          editingTaskId={editingTaskId}
          onEditToggle={onEditToggle}
          showDate={false}
          emptyMessage="Nothing scheduled for this day."
        />
        <AddTaskForm store={store} canEdit={canEdit} defaultDueDate={selectedDay} />
      </section>
    </div>
  )
}
