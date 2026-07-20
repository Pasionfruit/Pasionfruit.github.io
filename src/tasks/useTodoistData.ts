import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closeTask,
  createTaskDetailed,
  deleteTask,
  getActiveTasks,
  getProjects,
  getSections,
  rescheduleTask,
  updateTask,
} from '../data/todoist/repositories'
import type {
  TodoistProject,
  TodoistSection,
  TodoistTask,
  TodoistTaskDraft,
  TodoistTaskUpdate,
} from '../data/todoist/types'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/**
 * Single source of truth for the /tasks page.
 *
 * The whole active task list plus projects and sections are fetched once, and
 * every view (today, tomorrow, upcoming, projects) derives from that snapshot —
 * so switching views costs no network. Mutations apply optimistically, then a
 * silent background reload reconciles anything the server changed on its own
 * (recurring tasks rolling forward, for instance).
 */
export function useTodoistData(enabled: boolean) {
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [projects, setProjects] = useState<TodoistProject[]>([])
  const [sections, setSections] = useState<TodoistSection[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [loadError, setLoadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // No synchronous setState in load's pre-await body: isLoading starts true via
  // useState(enabled) for the mount fetch, and refresh() flips it in its own
  // handler. This keeps the mount effect free of cascading-render setState.
  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!enabled) {
        return
      }

      try {
        const [taskRows, projectRows, sectionRows] = await Promise.all([
          getActiveTasks(),
          getProjects(),
          getSections(),
        ])

        if (!isMountedRef.current) return
        setTasks(taskRows)
        setProjects(projectRows)
        setSections(sectionRows)
        setLoadError('')
      } catch (error) {
        if (!isMountedRef.current) return
        if (!options.silent) {
          setTasks([])
          setProjects([])
          setSections([])
        }
        setLoadError(errorMessage(error, 'Unable to load Todoist data'))
      } finally {
        if (isMountedRef.current && !options.silent) {
          setIsLoading(false)
        }
      }
    },
    [enabled],
  )

  useEffect(() => {
    // Fetch-on-mount: state only updates after the awaited fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const refresh = useCallback(() => {
    setIsLoading(true)
    return load()
  }, [load])

  /** Runs a mutation with an optimistic patch, rolling back if the call fails. */
  const mutate = useCallback(
    async (optimistic: (prev: TodoistTask[]) => TodoistTask[], run: () => Promise<void>, fallbackMessage: string) => {
      const snapshot = tasks
      setTasks(optimistic)
      setIsWriting(true)
      setWriteError('')

      try {
        await run()
        void load({ silent: true })
        return true
      } catch (error) {
        if (isMountedRef.current) {
          setTasks(snapshot)
          setWriteError(errorMessage(error, fallbackMessage))
        }
        return false
      } finally {
        if (isMountedRef.current) {
          setIsWriting(false)
        }
      }
    },
    [tasks, load],
  )

  const complete = useCallback(
    (taskId: string) => {
      // Closing a parent in Todoist closes its subtasks too.
      const doomed = new Set([taskId])
      let grew = true
      while (grew) {
        grew = false
        for (const task of tasks) {
          if (task.parent_id && doomed.has(task.parent_id) && !doomed.has(task.id)) {
            doomed.add(task.id)
            grew = true
          }
        }
      }

      return mutate(
        (prev) => prev.filter((task) => !doomed.has(task.id)),
        () => closeTask(taskId),
        'Unable to complete task',
      )
    },
    [mutate, tasks],
  )

  const remove = useCallback(
    (taskId: string) =>
      mutate(
        (prev) => prev.filter((task) => task.id !== taskId && task.parent_id !== taskId),
        () => deleteTask(taskId),
        'Unable to delete task',
      ),
    [mutate],
  )

  const save = useCallback(
    (taskId: string, update: TodoistTaskUpdate) =>
      mutate(
        (prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  content: update.content,
                  description: update.description ?? '',
                  priority: update.priority,
                  due: update.dueDate ? { ...task.due, date: update.dueDate, datetime: undefined } : null,
                }
              : task,
          ),
        () => updateTask(taskId, update),
        'Unable to update task',
      ),
    [mutate],
  )

  const reschedule = useCallback(
    (taskId: string, dueDate: string) =>
      mutate(
        (prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, due: dueDate ? { ...task.due, date: dueDate, datetime: undefined } : null }
              : task,
          ),
        () => rescheduleTask(taskId, dueDate),
        'Unable to reschedule task',
      ),
    [mutate],
  )

  const create = useCallback(
    async (draft: TodoistTaskDraft) => {
      setIsWriting(true)
      setWriteError('')
      try {
        const created = await createTaskDetailed(draft)
        if (isMountedRef.current) {
          setTasks((prev) => [...prev, created])
        }
        void load({ silent: true })
        return true
      } catch (error) {
        if (isMountedRef.current) {
          setWriteError(errorMessage(error, 'Unable to create task'))
        }
        return false
      } finally {
        if (isMountedRef.current) {
          setIsWriting(false)
        }
      }
    },
    [load],
  )

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )

  return {
    tasks,
    projects,
    sections,
    projectsById,
    isLoading,
    loadError,
    writeError,
    isWriting,
    setWriteError,
    refresh,
    complete,
    remove,
    save,
    reschedule,
    create,
  }
}

export type TodoistStore = ReturnType<typeof useTodoistData>
