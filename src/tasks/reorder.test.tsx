// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayKey } from '../data/todoist/dates'

const mocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(), getProjects: vi.fn(), getSections: vi.fn(), getTasksOfTheDay: vi.fn(),
  moveTask: vi.fn(), closeTask: vi.fn(), updateTask: vi.fn(), rescheduleTask: vi.fn(),
  createTaskDetailed: vi.fn(), deleteTask: vi.fn(),
}))
vi.mock('../data/todoist/repositories', () => mocks)
import { TasksPage } from './TasksPage'

const TODAY = todayKey()
const base = { project_id: 'proj-1', content: '', description: '', labels: [], priority: 4, is_completed: false, child_order: 0, due: null, section_id: 's1' }

beforeEach(() => {
  window.localStorage.clear()
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home' }])
  mocks.getSections.mockResolvedValue([{ id: 's1', project_id: 'proj-1', name: 'Errands', section_order: 0 }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setTasks(tasks: unknown[]) {
  mocks.getActiveTasks.mockResolvedValue(tasks)
}

async function openToday() {
  render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('.task-item')).not.toBeNull())
}

/** Titles of the top-level rows, in the order they show. */
function order() {
  return Array.from(document.querySelectorAll('.task-list > .task-item .task-title')).map((el) => el.textContent)
}

function moveButton(name: string, direction: 'up' | 'down') {
  return screen.getByRole('button', { name: `Move ${name} ${direction}` })
}

describe('moving tasks with the arrows', () => {
  beforeEach(() => {
    setTasks([
      { ...base, id: 'a', content: 'Alpha', due: { date: TODAY } },
      { ...base, id: 'b', content: 'Beta', due: { date: TODAY } },
      { ...base, id: 'c', content: 'Gamma', due: { date: TODAY } },
    ])
  })

  it('moves a task down one place on Today and saves the order', async () => {
    await openToday()
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])

    await userEvent.click(moveButton('Alpha', 'down'))

    expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
    expect(JSON.parse(window.localStorage.getItem('todoist-order:today') ?? '[]')).toEqual(['b', 'a', 'c'])
    expect(mocks.moveTask).not.toHaveBeenCalled()
  })

  it('moves a task up one place on Today', async () => {
    await openToday()

    await userEvent.click(moveButton('Gamma', 'up'))

    expect(order()).toEqual(['Alpha', 'Gamma', 'Beta'])
  })

  it('disables the arrow that would move past the first or last task', async () => {
    await openToday()

    expect((moveButton('Alpha', 'up') as HTMLButtonElement).disabled).toBe(true)
    expect((moveButton('Gamma', 'down') as HTMLButtonElement).disabled).toBe(true)
    expect((moveButton('Beta', 'up') as HTMLButtonElement).disabled).toBe(false)
  })

  it('lists a due subtask on its own beside its due parent, as the home card does', async () => {
    setTasks([
      { ...base, id: 'P', content: 'Alpha', due: { date: TODAY } },
      { ...base, id: 'c1', parent_id: 'P', content: 'Child one', due: { date: TODAY } },
      { ...base, id: 'c2', parent_id: 'P', content: 'Child two', due: { date: TODAY } },
    ])
    await openToday()
    expect(order()).toEqual(['Alpha', 'Child one', 'Child two'])
    expect(document.querySelectorAll('.task-subtasks').length).toBe(0)

    await userEvent.click(moveButton('Child two', 'up'))

    expect(order()).toEqual(['Alpha', 'Child two', 'Child one'])
  })
})
