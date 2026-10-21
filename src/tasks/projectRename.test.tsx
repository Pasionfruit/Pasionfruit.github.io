// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(), getProjects: vi.fn(), getSections: vi.fn(), getTasksOfTheDay: vi.fn(),
  updateProjectName: vi.fn(),
  updateProjectColor: vi.fn(),
}))
vi.mock('../data/todoist/repositories', () => mocks)
import { TasksPage } from './TasksPage'

const base = { project_id: 'proj-1', content: '', description: '', labels: [], priority: 4, is_completed: false, child_order: 0, due: null, section_id: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getActiveTasks.mockResolvedValue([{ ...base, id: 'a', content: 'Alpha' }])
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home', color: 'charcoal' }])
  mocks.updateProjectColor.mockImplementation(async (id: string, color: string) => {
    mocks.getProjects.mockResolvedValue([{ id, name: 'Home', color }])
  })
  mocks.getSections.mockResolvedValue([])
  // Todoist reports the new name on the next read, as the store's silent reload expects.
  mocks.updateProjectName.mockImplementation(async (id: string, name: string) => {
    mocks.getProjects.mockResolvedValue([{ id, name }])
  })
})
afterEach(() => cleanup())

async function openProjects() {
  render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
  await waitFor(async () => {
    if (!screen.queryByText('Alpha')) {
      await userEvent.click(screen.getByRole('button', { name: /^Projects/ }))
    }
    expect(screen.getByText('Alpha')).toBeTruthy()
  })
}

describe('renaming a project', () => {
  it('saves the new name to Todoist and shows it', async () => {
    await openProjects()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Home' }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    await userEvent.clear(input)
    await userEvent.type(input, '  Household  ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateProjectName).toHaveBeenCalledWith('proj-1', 'Household'))
    expect(await screen.findByRole('heading', { name: /Household/ })).toBeTruthy()
  })

  it('cancelling leaves the name alone', async () => {
    await openProjects()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.updateProjectName).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /Home/ })).toBeTruthy()
  })

  it('does not call Todoist for an empty name', async () => {
    await openProjects()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Home' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Project name' }))
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    expect(mocks.updateProjectName).not.toHaveBeenCalled()
  })

  it('changes the project color through Todoist and marks the new swatch', async () => {
    await openProjects()
    await userEvent.click(screen.getByRole('button', { name: 'Change color of Home' }))
    await userEvent.click(screen.getByRole('button', { name: 'berry red' }))
    await waitFor(() => expect(mocks.updateProjectColor).toHaveBeenCalledWith('proj-1', 'berry_red'))
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Color for Home' })).toBeNull(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Change color of Home' }))
    expect(screen.getByRole('button', { name: 'berry red (current)' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('moves a project right in the rail and saves the new order', async () => {
    window.localStorage.clear()
    mocks.getProjects.mockResolvedValue([
      { id: 'proj-1', name: 'Home', color: 'charcoal' },
      { id: 'proj-2', name: 'Work', color: 'blue' },
    ])
    await openProjects()
    const railNames = () =>
      Array.from(document.querySelectorAll('.tasks-project-chip .tasks-project-name')).map((el) => el.textContent)
    expect(railNames()).toEqual(['Home', 'Work'])

    await userEvent.click(screen.getByRole('button', { name: 'Move Home right' }))
    expect(railNames()).toEqual(['Work', 'Home'])
    expect(JSON.parse(window.localStorage.getItem('todoist-order:projects') ?? '[]')).toEqual(['proj-2', 'proj-1'])
  })
})
