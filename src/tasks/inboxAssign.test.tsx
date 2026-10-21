// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(), getProjects: vi.fn(), getSections: vi.fn(), getTasksOfTheDay: vi.fn(),
  moveTask: vi.fn(),
}))
vi.mock('../data/todoist/repositories', () => mocks)
import { TasksPage } from './TasksPage'

const base = { content: '', description: '', labels: [], priority: 4, is_completed: false, child_order: 0, due: null, section_id: null, parent_id: null }

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.moveTask.mockResolvedValue(undefined)
  mocks.getActiveTasks.mockResolvedValue([{ ...base, id: 'milk', project_id: 'inbox', content: 'Buy milk' }])
  mocks.getProjects.mockResolvedValue([
    { id: 'inbox', name: 'Inbox', is_inbox_project: true },
    { id: 'work', name: 'Work' },
  ])
  mocks.getSections.mockResolvedValue([])
})
afterEach(() => cleanup())

describe('assigning an Inbox task to a project', () => {
  it('files the task into the chosen project from its editor', async () => {
    render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
    await waitFor(() => expect(screen.queryByText('Loading Todoist…')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: /^Projects/ }))
    await userEvent.click(await screen.findByText('Buy milk'))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'work')

    await waitFor(() => {
      expect(mocks.moveTask).toHaveBeenCalledWith('milk', { parentId: null, projectId: 'work', sectionId: null })
    })
  })

  it('offers every project, marking the Inbox', async () => {
    render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
    await waitFor(() => expect(screen.queryByText('Loading Todoist…')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: /^Projects/ }))
    await userEvent.click(await screen.findByText('Buy milk'))

    const picker = screen.getByRole('combobox', { name: 'Project' }) as HTMLSelectElement
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual(['Inbox (Inbox)', 'Work'])
    expect(picker.value).toBe('inbox')
  })
})
