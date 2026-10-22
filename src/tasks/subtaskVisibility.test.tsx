// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(),
  getProjects: vi.fn(),
  getSections: vi.fn(),
  getTasksOfTheDay: vi.fn(),
  createTaskDetailed: vi.fn(),
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
}))
vi.mock('../data/todoist/repositories', () => mocks)

import { TasksPage } from './TasksPage'
import { todayKey } from '../data/todoist/dates'

const TODAY = todayKey()

const base = {
  project_id: 'proj-1',
  content: '',
  description: '',
  labels: [],
  priority: 4,
  is_completed: false,
  child_order: 0,
  due: null,
}

afterEach(() => cleanup())

async function openTasks(tasks: unknown[], tab: RegExp | null) {
  mocks.getActiveTasks.mockResolvedValue(tasks)
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home' }])
  mocks.getSections.mockResolvedValue([{ id: 's1', project_id: 'proj-1', name: 'Errands', section_order: 0 }])
  render(
    <MemoryRouter>
      <TasksPage canEdit configured />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByText('Loading Todoist…')).toBeNull())
  if (tab) await userEvent.click(screen.getByRole('button', { name: tab }))
}

/** The task row's own container, so we can ask what sits inside it. */
function itemOf(text: string) {
  return screen.getByText(text).closest('.task-item') as HTMLElement
}

describe('nested subtasks', () => {
  it('renders grandchildren under their child', async () => {
    await openTasks(
      [
        { ...base, id: 'p', section_id: 's1', content: 'Parent' },
        { ...base, id: 'c', parent_id: 'p', section_id: 's1', content: 'Child' },
        { ...base, id: 'g', parent_id: 'c', section_id: 's1', content: 'Grandchild' },
      ],
      /^Projects/,
    )
    expect(itemOf('Child').querySelector('.task-item')?.textContent).toContain('Grandchild')
  })
})

describe('subtask parents in date views', () => {
  it('shows a dated subtask alone when its parent has no date', async () => {
    await openTasks(
      [
        { ...base, id: 'p', content: 'Parent' },
        { ...base, id: 'c', parent_id: 'p', content: 'Child', due: { date: TODAY } },
      ],
      null,
    )
    expect(screen.queryByText('Parent')).toBeNull()
    expect(itemOf('Child').closest('.task-subtasks')).toBeNull()
  })
})

describe('deleting from the row', () => {
  it('deletes a task from its trash icon without opening the editor', async () => {
    mocks.deleteTask.mockResolvedValue(undefined)
    await openTasks([{ ...base, id: 'b', content: 'Second', due: { date: TODAY } }], null)

    await userEvent.click(screen.getByRole('button', { name: 'Delete Second' }))

    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledWith('b'))
    expect(screen.queryByLabelText('Task name')).toBeNull()
  })
})

describe('repeating from the editor', () => {
  it('saves a repeat with its interval when Repeat is on', async () => {
    mocks.updateTask.mockResolvedValue(undefined)
    await openTasks([{ ...base, id: 'r', content: 'Water', due: { date: TODAY } }], null)

    await userEvent.click(screen.getByText('Water'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Repeat' }))
    await userEvent.clear(screen.getByLabelText('Repeat every'))
    await userEvent.type(screen.getByLabelText('Repeat every'), '2')
    await userEvent.selectOptions(screen.getByLabelText('Repeat unit'), 'week')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mocks.updateTask).toHaveBeenCalledWith(
        'r',
        expect.objectContaining({ repeat: { every: 2, unit: 'week' } }),
      ),
    )
  })
})

describe('add forms and the task editor', () => {
  it('closes an open add form when another task is clicked', async () => {
    await openTasks(
      [
        { ...base, id: 'a', content: 'First', due: { date: TODAY } },
        { ...base, id: 'b', content: 'Second', due: { date: TODAY } },
      ],
      null,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByLabelText('New task name')).toBeTruthy()

    await userEvent.click(screen.getByText('Second'))
    expect(screen.queryByLabelText('New task name')).toBeNull()
  })
})

describe('adding a subtask from the editor', () => {
  it('creates the subtask under the clicked task', async () => {
    mocks.createTaskDetailed.mockResolvedValue({
      ...base,
      id: 'n',
      parent_id: 'p',
      content: 'New sub',
      due: { date: TODAY },
    })
    await openTasks([{ ...base, id: 'p', content: 'Parent', due: { date: TODAY } }], null)

    await userEvent.click(screen.getByText('Parent'))
    await userEvent.click(screen.getByRole('button', { name: 'Add subtask' }))
    await userEvent.type(screen.getByLabelText('New subtask name'), 'New sub')
    await userEvent.click(screen.getByRole('button', { name: 'Add subtask' }))

    await waitFor(() =>
      expect(mocks.createTaskDetailed).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'New sub', parentId: 'p', dueDate: TODAY }),
      ),
    )
    // The form stays open, cleared, ready for the next subtask.
    await waitFor(() => expect((screen.getByLabelText('New subtask name') as HTMLInputElement).value).toBe(''))
  })
})
