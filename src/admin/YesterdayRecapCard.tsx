import { useEffect, useState } from 'react'
import { getActiveTasks, getCompletedTasks } from '../data/todoist/repositories'
import { addDaysToKey, dueDateKey, todayKey } from '../data/todoist/dates'
import type { TodoistTask } from '../data/todoist/types'

type Recap = {
  completed: TodoistTask[]
  /** Due yesterday, still open this morning — the things that quietly slipped. */
  slipped: TodoistTask[]
}

/**
 * Yesterday in two numbers: what closed, and what was due and did not. The
 * slipped list is the useful half — those tasks are now overdue and will
 * otherwise blend into today's list without ever being noticed as late.
 */
export function YesterdayRecapCard({ title, configured }: { title: string; configured: boolean }) {
  const [recap, setRecap] = useState<Recap>({ completed: [], slipped: [] })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(configured)

  useEffect(() => {
    if (!configured) {
      return
    }

    let cancelled = false
    const yesterday = addDaysToKey(todayKey(), -1)

    void (async () => {
      try {
        const [completed, active] = await Promise.all([
          getCompletedTasks(yesterday, yesterday),
          getActiveTasks(),
        ])

        if (!cancelled) {
          setRecap({
            completed,
            slipped: active.filter((task) => dueDateKey(task) === yesterday),
          })
          setError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load yesterday')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [configured])

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        {configured && !isLoading && !error ? (
          <span className="admin-pill">
            {recap.completed.length} done · {recap.slipped.length} slipped
          </span>
        ) : null}
      </div>

      {!configured ? (
        <p className="sheets-meta">
          Set VITE_TODOIST_API_TOKEN to pull yesterday&apos;s completed and missed tasks.
        </p>
      ) : isLoading ? (
        <p className="sheets-meta">Loading yesterday…</p>
      ) : error ? (
        <p className="sheets-meta">{error}</p>
      ) : (
        <div className="recap-columns">
          <div className="recap-column">
            <h4>Closed</h4>
            {recap.completed.length === 0 ? (
              <p className="sheets-meta">Nothing was completed yesterday.</p>
            ) : (
              <ul className="recap-list">
                {recap.completed.map((task) => (
                  <li key={task.id}>{task.content}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="recap-column">
            <h4>Slipped to today</h4>
            {recap.slipped.length === 0 ? (
              <p className="sheets-meta">Nothing was left behind.</p>
            ) : (
              <ul className="recap-list recap-list-slipped">
                {recap.slipped.map((task) => (
                  <li key={task.id}>{task.content}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
