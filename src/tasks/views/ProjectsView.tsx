import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil } from 'lucide-react'
import { AddTaskForm, TaskList } from '../TaskList'
import { inheritedSectionId, sortByPriorityThenDue } from '../grouping'
import { isSectionHidden, orderSections, rowsForOrder } from '../sectionLayout'
import type { TaskLayoutStore } from '../useTaskLayout'
import type { TodoistProject, TodoistSection, TodoistTask } from '../../data/todoist/types'
import type { TodoistStore } from '../useTodoistData'
import type { ViewProps } from './TodayView'

export function ProjectsView({
  store,
  canEdit,
  editingTaskId,
  onEditToggle,
  layout,
}: ViewProps & { layout: TaskLayoutStore }) {
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

  // Every section of the project in saved order, hidden ones included.
  const projectSections = useMemo(
    () =>
      orderSections(
        store.sections.filter((section) => section.project_id === activeProjectId),
        layout.layout,
      ),
    [store.sections, activeProjectId, layout.layout],
  )
  const visibleSections = projectSections.filter((section) => !isSectionHidden(section.id, layout.layout))
  const hiddenSections = projectSections.filter((section) => isSectionHidden(section.id, layout.layout))

  // Swaps a visible section with its visible neighbour, so hidden sections never get jumped over.
  function moveSection(section: TodoistSection, delta: -1 | 1) {
    if (!activeProjectId) return
    const visibleIndex = visibleSections.indexOf(section)
    const neighbour = visibleSections[visibleIndex + delta]
    if (!neighbour) return

    const ordered = [...projectSections]
    const from = ordered.indexOf(section)
    const to = ordered.indexOf(neighbour)
    ;[ordered[from], ordered[to]] = [ordered[to], ordered[from]]
    void layout.saveRows(rowsForOrder(activeProjectId, ordered, layout.layout))
  }

  function setSectionHidden(section: TodoistSection, hidden: boolean) {
    if (!activeProjectId) return
    const rows = rowsForOrder(activeProjectId, projectSections, layout.layout)
    rows[section.id] = { ...rows[section.id], hidden }
    void layout.saveRows(rows)
  }

  const projectTasks = useMemo(
    () => (activeProjectId ? tasksByProject.get(activeProjectId) ?? [] : []),
    [tasksByProject, activeProjectId],
  )
  // Subtasks follow their parent into its section, whatever Todoist reports for their own section.
  const sectionById = useMemo(() => {
    const byId = new Map(store.tasks.map((task) => [task.id, task]))
    return new Map(projectTasks.map((task) => [task.id, inheritedSectionId(task, byId)]))
  }, [store.tasks, projectTasks])

  const looseTasks = useMemo(
    () => sortByPriorityThenDue(projectTasks.filter((task) => !sectionById.get(task.id))),
    [projectTasks, sectionById],
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
          <ProjectName
            key={activeProjectId ?? 'none'}
            project={activeProject}
            count={projectTasks.length}
            store={store}
            canEdit={canEdit}
          />
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

        {layout.error ? (
          <p className="sheets-error" role="alert">
            {layout.error}
          </p>
        ) : null}

        {visibleSections.map((section, index) => {
          const sectionTasks = sortByPriorityThenDue(
            projectTasks.filter((task) => sectionById.get(task.id) === section.id),
          )

          return (
            <section key={section.id} className="tasks-group tasks-section">
              <header className="tasks-group-header">
                <h3>
                  {section.name}
                  <span className="tasks-count">{sectionTasks.length}</span>
                </h3>
                {canEdit ? (
                  <div className="tasks-section-controls">
                    <button
                      type="button"
                      className="tasks-section-control"
                      onClick={() => moveSection(section, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${section.name} up`}
                      title="Move up"
                    >
                      <ChevronUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="tasks-section-control"
                      onClick={() => moveSection(section, 1)}
                      disabled={index === visibleSections.length - 1}
                      aria-label={`Move ${section.name} down`}
                      title="Move down"
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="tasks-section-control"
                      onClick={() => setSectionHidden(section, true)}
                      aria-label={`Hide ${section.name}`}
                      title="Hide section"
                    >
                      <EyeOff size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
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

        {canEdit && hiddenSections.length > 0 ? (
          <details className="tasks-hidden-sections">
            <summary>Hidden sections ({hiddenSections.length})</summary>
            <ul>
              {hiddenSections.map((section) => (
                <li key={section.id}>
                  <span>{section.name}</span>
                  <button
                    type="button"
                    className="tasks-section-control"
                    onClick={() => setSectionHidden(section, false)}
                    aria-label={`Show ${section.name}`}
                    title="Show section"
                  >
                    <Eye size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}

/** The project's title, with a rename form in place of it while editing. Keyed by project, so a draft never carries over. */
function ProjectName({
  project,
  count,
  store,
  canEdit,
}: {
  project: TodoistProject | undefined
  count: number
  store: TodoistStore
  canEdit: boolean
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(project?.name ?? '')

  if (!isRenaming || !project) {
    return (
      <>
        <h2>
          {project?.name ?? 'Project'}
          <span className="tasks-count">{count}</span>
        </h2>
        {canEdit && project ? (
          <button
            type="button"
            className="tasks-section-control"
            aria-label={`Rename ${project.name}`}
            title="Rename project"
            onClick={() => {
              setDraft(project.name)
              setIsRenaming(true)
            }}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : null}
      </>
    )
  }

  const trimmed = draft.trim()
  const current = project

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed || trimmed === current.name) {
      setIsRenaming(false)
      return
    }
    if (await store.renameProject(current.id, trimmed)) {
      setIsRenaming(false)
    }
  }

  return (
    <form className="project-rename" onSubmit={(event) => void handleSubmit(event)}>
      <input
        className="task-input"
        value={draft}
        autoFocus
        aria-label="Project name"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsRenaming(false)
        }}
      />
      <button type="submit" className="task-btn is-primary" disabled={store.isWriting || !trimmed}>
        Save
      </button>
      <button type="button" className="task-btn" onClick={() => setIsRenaming(false)}>
        Cancel
      </button>
    </form>
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
