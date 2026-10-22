// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  mocks.getActiveTasks.mockResolvedValue([
    { ...base, id: 'a', content: 'Alpha', due: { date: TODAY } },
    { ...base, id: 'b', content: 'Beta', due: { date: TODAY } },
    { ...base, id: 'c', content: 'Gamma', due: { date: TODAY } },
  ])
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home' }])
  mocks.getSections.mockResolvedValue([{ id: 's1', project_id: 'proj-1', name: 'Errands', section_order: 0 }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const ROW = 60
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.task-item[data-task-id]'))
    const item = this.closest<HTMLElement>('.task-item[data-task-id]')
    const index = item ? items.indexOf(item) : -1
    const top = index >= 0 ? index * ROW : 0
    const bottom = top + ROW
    return { top, bottom, left: 0, right: 300, width: 300, height: ROW, x: 0, y: top, toJSON() { return {} } } as DOMRect
  })
}

function order() {
  return Array.from(document.querySelectorAll('.task-item[data-depth="0"] .task-title')).map((el) => el.textContent)
}

describe('today reorder', () => {
  it('moves Alpha below Gamma on Today', async () => {
    fakeLayout()
    render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy())
    const list = screen.getByText('Alpha').closest('.task-list') as HTMLElement
    const grip = screen.getByText('Alpha').closest('.task-item')!.querySelector('.task-drag-handle') as HTMLElement
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 0, clientY: 10, pointerType: 'mouse', button: 0 })
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 0, clientY: 100, pointerType: 'mouse' })
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 0, clientY: 175, pointerType: 'mouse' })
    fireEvent.pointerUp(list, { pointerId: 1, clientX: 0, clientY: 175, pointerType: 'mouse' })
    expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])
  })
})
