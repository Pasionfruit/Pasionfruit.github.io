import { useMemo, useState } from 'react'
import { AddTaskForm, TaskList } from '../TaskList'
import { sortByPriorityThenDue } from '../grouping'
import type { TodoistTask } from '../../data/todoist/types'
import type { ViewProps } from './TodayView'

export function ProjectsView({ store, canEdit, editingTaskId, onEditToggle }: ViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const tasksByProject = useMemo(() => {
    const map = new Map<string, TodoistTask[]>()
    for (const task of store.tasks) {
      const key = task.project_id ?? ''
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(task)
      } else {
        map.set(key, [task])
      }
    }
    return map
  }, [store.tasks])

  const activeProjectId = selectedProjectId ?? store.projects[0]?.id ?? null
  const activeProject = activeProjectId ? store.projectsById.get(activeProjectId) : undefined

  const projectSections = useMemo(
    () =>
      store.sections
        .filter((section) => section.project_id === activeProjectId)
        .sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0)),
    [store.sections, activeProjectId],
  )

  const projectTasks = useMemo(
    () => (activeProjectId ? tasksByProject.get(activeProjectId) ?? [] : []),
    [tasksByProject, activeProjectId],
  )
  const looseTasks = useMemo(
    () => sortByPriorityThenDue(projectTasks.filter((task) => !task.section_id)),
    [projectTasks],
  )

  if (store.projects.length === 0) {
    return <p className="tasks-empty">No projects found.</p>
  }

  return (
    <div className="tasks-view tasks-projects">
      {/* Desktop: a horizontally scrollable chip rail. */}
      <nav className="tasks-project-rail" aria-label="Projects">
        {store.projects.map((project) => {
          const count = (tasksByProject.get(project.id) ?? []).length
          return (
            <button
              key={project.id}
              type="button"
              className={`tasks-project-chip${project.id === activeProjectId ? ' is-active' : ''}`}
              aria-current={project.id === activeProjectId}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <span className="tasks-project-dot" style={{ background: colorFor(project.color) }} aria-hidden="true" />
              <span className="tasks-project-name">{project.name}</span>
              <span className="tasks-count">{count}</span>
            </button>
          )
        })}
      </nav>

      {/* Mobile: a native picker so every project is one tap away. */}
      <div className="tasks-project-select">
        <span
          className="tasks-project-select-dot"
          style={{ background: colorFor(activeProject?.color) }}
          aria-hidden="true"
        />
        <select
          className="tasks-project-select-input"
          aria-label="Choose a project"
          value={activeProjectId ?? ''}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          {store.projects.map((project) => {
            const count = (tasksByProject.get(project.id) ?? []).length
            return (
              <option key={project.id} value={project.id}>
                {project.name} ({count})
              </option>
            )
          })}
        </select>
      </div>

      <div className="tasks-project-body">
        <header className="tasks-group-header">
          <h2>
            {activeProject?.name ?? 'Project'}
            <span className="tasks-count">{projectTasks.length}</span>
          </h2>
        </header>

        <TaskList
          tasks={looseTasks}
          store={store}
          canEdit={canEdit}
          editingTaskId={editingTaskId}
          onEditToggle={onEditToggle}
          showProject={false}
          emptyMessage={projectSections.length > 0 ? '' : 'No tasks in this project.'}
          orderKey={activeProjectId ? `project:${activeProjectId}` : undefined}
        />
        <AddTaskForm
          store={store}
          canEdit={canEdit}
          defaultProjectId={activeProjectId ?? undefined}
          label="Add task to project"
        />

        {projectSections.map((section) => {
          const sectionTasks = sortByPriorityThenDue(
            projectTasks.filter((task) => task.section_id === section.id),
          )

          return (
            <section key={section.id} className="tasks-group tasks-section">
              <header className="tasks-group-header">
                <h3>
                  {section.name}
                  <span className="tasks-count">{sectionTasks.length}</span>
                </h3>
              </header>
              <TaskList
                tasks={sectionTasks}
                store={store}
                canEdit={canEdit}
                editingTaskId={editingTaskId}
                onEditToggle={onEditToggle}
                showProject={false}
                emptyMessage="No tasks in this section."
                orderKey={activeProjectId ? `project:${activeProjectId}:section:${section.id}` : undefined}
              />
              <AddTaskForm
                store={store}
                canEdit={canEdit}
                defaultProjectId={activeProjectId ?? undefined}
                defaultSectionId={section.id}
              />
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Todoist ships named colors; fall back to the app accent for unknown values. */
const PROJECT_COLORS: Record<string, string> = {
  berry_red: '#b8256f',
  red: '#db4035',
  orange: '#ff9933',
  yellow: '#fad000',
  olive_green: '#afb83b',
  lime_green: '#7ecc49',
  green: '#299438',
  mint_green: '#6accbc',
  teal: '#158fad',
  sky_blue: '#14aaf5',
  light_blue: '#96c3eb',
  blue: '#4073ff',
  grape: '#884dff',
  violet: '#af38eb',
  lavender: '#eb96eb',
  magenta: '#e05194',
  salmon: '#ff8d85',
  charcoal: '#808080',
  grey: '#b8b8b8',
  taupe: '#ccac93',
}

function colorFor(color?: string) {
  if (!color) return 'var(--accent, #7a62ff)'
  return PROJECT_COLORS[color] ?? color
}
