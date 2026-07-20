import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTodoistData } from './useTodoistData'
import { TodayView } from './views/TodayView'
import { TomorrowView } from './views/TomorrowView'
import { UpcomingView } from './views/UpcomingView'
import { ProjectsView } from './views/ProjectsView'
import { dueDateKey, todayKey, tomorrowKey } from '../data/todoist/dates'
import './tasks.css'

type TaskView = 'today' | 'tomorrow' | 'upcoming' | 'projects'

const VIEWS: { id: TaskView; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'projects', label: 'Projects' },
]

export function TasksPage({
  canEdit,
  configured,
  editorEmail,
}: {
  canEdit: boolean
  configured: boolean
  editorEmail: string
}) {
  const [view, setView] = useState<TaskView>('today')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const store = useTodoistData(configured)

  const today = todayKey()
  const tomorrow = tomorrowKey()
  const counts = {
    today: store.tasks.filter((task) => {
      const key = dueDateKey(task)
      return Boolean(key) && key <= today
    }).length,
    tomorrow: store.tasks.filter((task) => dueDateKey(task) === tomorrow).length,
    upcoming: store.tasks.filter((task) => dueDateKey(task) > today).length,
    projects: store.projects.length,
  }

  function handleViewChange(next: TaskView) {
    setEditingTaskId(null)
    setView(next)
  }

  const viewProps = {
    store,
    canEdit,
    editingTaskId,
    onEditToggle: setEditingTaskId,
  }

  return (
    <div className="page-frame tasks-page" style={{ '--page-accent': '#d1453b' } as CSSProperties}>
      <section className="page-hero">
        <div className="page-hero-header">
          <Link to="/" className="back-link" aria-label="Back to home" title="Back to home">
            <span aria-hidden="true">&lt;</span>
          </Link>
          <div className="page-title-block">
            <p className="eyebrow">Todoist</p>
            <h1>Tasks</h1>
          </div>
        </div>
        <p className="page-summary">
          Overdue and today at a glance, tomorrow on deck, a calendar for what is coming, and every project in one
          place.
        </p>
      </section>

      <nav className="tasks-tabs" aria-label="Task views">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`tasks-tab${view === entry.id ? ' is-active' : ''}`}
            aria-current={view === entry.id}
            onClick={() => handleViewChange(entry.id)}
          >
            {entry.label}
            {counts[entry.id] > 0 ? <span className="tasks-count">{counts[entry.id]}</span> : null}
          </button>
        ))}

        <button
          type="button"
          className="tasks-refresh"
          onClick={() => void store.refresh()}
          disabled={store.isLoading}
          aria-label="Refresh tasks"
          title="Refresh tasks"
        >
          ↻
        </button>
      </nav>

      {!configured ? (
        <p className="sheets-error">Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.</p>
      ) : null}

      {configured && !canEdit ? (
        <p className="sheets-meta">Edit access restricted to Admin profile signed in as {editorEmail}.</p>
      ) : null}

      {store.loadError ? <p className="sheets-error">{store.loadError}</p> : null}
      {store.writeError ? (
        <p className="sheets-error" role="alert">
          {store.writeError}
        </p>
      ) : null}

      {configured && store.isLoading ? <p className="sheets-meta">Loading Todoist…</p> : null}

      {configured && !store.isLoading ? (
        <>
          {view === 'today' ? <TodayView {...viewProps} /> : null}
          {view === 'tomorrow' ? <TomorrowView {...viewProps} /> : null}
          {view === 'upcoming' ? <UpcomingView {...viewProps} /> : null}
          {view === 'projects' ? <ProjectsView {...viewProps} /> : null}
        </>
      ) : null}
    </div>
  )
}

export default TasksPage
