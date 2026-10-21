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
}))
vi.mock('../data/todoist/repositories', () => mocks)

import { TasksPage } from './TasksPage'

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

async function openProjects(tasks: unknown[]) {
  mocks.getActiveTasks.mockResolvedValue(tasks)
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home' }])
  mocks.getSections.mockResolvedValue([{ id: 's1', project_id: 'proj-1', name: 'Errands', section_order: 0 }])
  render(
    <MemoryRouter>
      <TasksPage canEdit configured />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByText('Loading Todoist…')).toBeNull())
  await userEvent.click(screen.getByRole('button', { name: /^Projects/ }))
}

function subtasksOf(parentText: string) {
  const parent = screen.getByText(parentText).closest('.task-item') as HTMLElement
  return parent.querySelector('.task-subtasks')?.textContent ?? ''
}

describe('subtasks on the Projects view', () => {
  it('shows a subtask under its parent when the subtask carries the section', async () => {
    await openProjects([
      { ...base, id: 'p', section_id: 's1', content: 'Parent' },
      { ...base, id: 'c', parent_id: 'p', section_id: 's1', content: 'Child' },
    ])
    expect(subtasksOf('Parent')).toContain('Child')
  })

  it('shows a subtask under its parent when Todoist leaves the subtask without a section', async () => {
    await openProjects([
      { ...base, id: 'p', section_id: 's1', content: 'Parent' },
      { ...base, id: 'c', parent_id: 'p', section_id: null, content: 'Child' },
    ])
    expect(subtasksOf('Parent')).toContain('Child')
    expect(screen.getAllByText('Child')).toHaveLength(1)
  })
})
