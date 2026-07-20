// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const todoistMocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(),
  getProjects: vi.fn(),
  getSections: vi.fn(),
  getTasksOfTheDay: vi.fn(),
  createTask: vi.fn(),
  createTaskDetailed: vi.fn(),
  updateTask: vi.fn(),
  rescheduleTask: vi.fn(),
  closeTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../data/todoist/repositories', () => todoistMocks)

import { TasksPage } from './TasksPage'
import { addDaysToKey, todayKey } from '../data/todoist/dates'

const TODAY = todayKey()
const TOMORROW = addDaysToKey(TODAY, 1)
const YESTERDAY = addDaysToKey(TODAY, -1)
const NEXT_WEEK = addDaysToKey(TODAY, 5)

function task(overrides: Record<string, unknown>) {
  return {
    id: 'task-1',
    parent_id: null,
    project_id: 'proj-1',
    section_id: null,
    content: 'A task',
    description: '',
    labels: [],
    priority: 4,
    is_completed: false,
    child_order: 0,
    due: null,
    ...overrides,
  }
}

function renderTasksPage(canEdit = true) {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage canEdit={canEdit} configured editorEmail="pasionabe@gmail.com" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  todoistMocks.getActiveTasks.mockResolvedValue([
    task({ id: 'overdue-1', content: 'Renew passport', priority: 1, due: { date: YESTERDAY } }),
    task({ id: 'today-1', content: 'Standup notes', priority: 2, due: { date: TODAY } }),
    task({ id: 'tomorrow-1', content: 'Book flights', due: { date: TOMORROW } }),
    task({ id: 'later-1', content: 'Quarterly review', due: { date: NEXT_WEEK } }),
    task({ id: 'someday-1', content: 'Undated idea', due: null }),
    task({ id: 'other-proj', content: 'Water plants', project_id: 'proj-2', due: null }),
  ])
  todoistMocks.getProjects.mockResolvedValue([
    { id: 'proj-1', name: 'Inbox', is_inbox_project: true, child_order: 0 },
    { id: 'proj-2', name: 'Home', is_inbox_project: false, child_order: 1 },
  ])
  todoistMocks.getSections.mockResolvedValue([])
  todoistMocks.closeTask.mockResolvedValue(undefined)
  todoistMocks.rescheduleTask.mockResolvedValue(undefined)
  todoistMocks.createTaskDetailed.mockResolvedValue(task({ id: 'new-1', content: 'Fresh task' }))
})

afterEach(() => {
  cleanup()
})

describe('TasksPage', () => {
  it('separates overdue from today on the Today view', async () => {
    renderTasksPage()

    const overdueHeading = await screen.findByRole('heading', { name: /Overdue/ })
    const overdueGroup = overdueHeading.closest('section') as HTMLElement
    expect(within(overdueGroup).getByText('Renew passport')).toBeTruthy()
    expect(within(overdueGroup).queryByText('Standup notes')).toBeNull()

    const todayGroup = screen.getByRole('heading', { name: /Today/ }).closest('section') as HTMLElement
    expect(within(todayGroup).getByText('Standup notes')).toBeTruthy()

    // Future and undated tasks stay out of the Today view entirely.
    expect(screen.queryByText('Book flights')).toBeNull()
    expect(screen.queryByText('Quarterly review')).toBeNull()
    expect(screen.queryByText('Undated idea')).toBeNull()
  })

  it('completes a task optimistically', async () => {
    const user = userEvent.setup()
    // The background reconcile fetch reflects the task being gone server-side.
    todoistMocks.closeTask.mockImplementation(async () => {
      todoistMocks.getActiveTasks.mockResolvedValue([
        task({ id: 'overdue-1', content: 'Renew passport', priority: 1, due: { date: YESTERDAY } }),
      ])
    })
    renderTasksPage()

    await screen.findByText('Standup notes')
    await user.click(screen.getByRole('button', { name: 'Complete Standup notes' }))

    await waitFor(() => {
      expect(todoistMocks.closeTask).toHaveBeenCalledWith('today-1')
    })
    await waitFor(() => {
      expect(screen.queryByText('Standup notes')).toBeNull()
    })
  })

  it('reschedules an overdue task to today', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Renew passport')
    await user.click(screen.getByRole('button', { name: 'Reschedule to today' }))

    await waitFor(() => {
      expect(todoistMocks.rescheduleTask).toHaveBeenCalledWith('overdue-1', TODAY)
    })
  })

  it('shows only tomorrow tasks on the Tomorrow view', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Standup notes')
    await user.click(screen.getByRole('button', { name: /^Tomorrow/ }))

    expect(await screen.findByText('Book flights')).toBeTruthy()
    expect(screen.queryByText('Standup notes')).toBeNull()
    expect(screen.queryByText('Renew passport')).toBeNull()
  })

  it('renders a month calendar and lists the selected day on the Upcoming view', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Standup notes')
    await user.click(screen.getByRole('button', { name: /^Upcoming/ }))

    const grid = await screen.findByRole('grid')
    expect(grid).toBeTruthy()

    // Defaults to today, so today's task is listed under the calendar.
    expect(screen.getByText('Standup notes')).toBeTruthy()

    await user.click(within(grid).getByRole('gridcell', { name: /Tomorrow/ }))
    expect(await screen.findByText('Book flights')).toBeTruthy()
    expect(screen.queryByText('Standup notes')).toBeNull()
  })

  it('groups tasks by project on the Projects view', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Standup notes')
    await user.click(screen.getByRole('button', { name: /^Projects/ }))

    // Inbox is selected first; it owns everything except the Home task.
    expect(await screen.findByText('Undated idea')).toBeTruthy()
    expect(screen.queryByText('Water plants')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Home/ }))
    expect(await screen.findByText('Water plants')).toBeTruthy()
    expect(screen.queryByText('Undated idea')).toBeNull()
  })

  it('creates a task into the selected day', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Standup notes')
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await user.type(screen.getByLabelText('New task name'), 'Fresh task')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    await waitFor(() => {
      expect(todoistMocks.createTaskDetailed).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Fresh task', dueDate: TODAY }),
      )
    })
  })

  it('hides write affordances when the viewer cannot edit', async () => {
    renderTasksPage(false)

    await screen.findByText('Standup notes')
    expect(screen.queryByRole('button', { name: /Add task/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Complete Standup notes' })).toHaveProperty('disabled', true)
  })

  it('surfaces a load failure', async () => {
    todoistMocks.getActiveTasks.mockRejectedValue(new Error('Todoist token is invalid or does not have access.'))
    renderTasksPage()

    expect(await screen.findByText('Todoist token is invalid or does not have access.')).toBeTruthy()
  })
})
