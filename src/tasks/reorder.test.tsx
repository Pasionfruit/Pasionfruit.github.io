// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(), getProjects: vi.fn(), getSections: vi.fn(), getTasksOfTheDay: vi.fn(),
  moveTask: vi.fn(), closeTask: vi.fn(), updateTask: vi.fn(), rescheduleTask: vi.fn(),
  createTaskDetailed: vi.fn(), deleteTask: vi.fn(),
}))
vi.mock('../data/todoist/repositories', () => mocks)
import { TasksPage } from './TasksPage'

const base = { project_id: 'proj-1', content: '', description: '', labels: [], priority: 4, is_completed: false, child_order: 0, due: null, section_id: 's1' }

beforeEach(() => {
  window.localStorage.clear()
  mocks.moveTask.mockResolvedValue(undefined)
  mocks.getActiveTasks.mockResolvedValue([
    { ...base, id: 'a', content: 'Alpha' },
    { ...base, id: 'b', content: 'Beta' },
    { ...base, id: 'c', content: 'Gamma' },
  ])
  mocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Home' }])
  mocks.getSections.mockResolvedValue([{ id: 's1', project_id: 'proj-1', name: 'Errands', section_order: 0 }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

// Fake layout: every visible task row is 60px tall, stacked in document order. A task's
// block also covers its visible subtasks, as on screen.
const ROW = 60
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.task-item[data-task-id]'))
    const item = this.closest<HTMLElement>('.task-item[data-task-id]')
    const index = item ? items.indexOf(item) : -1
    const top = index >= 0 ? index * ROW : 0
    const depth = Number(item?.dataset.depth ?? 0)
    let end = index + 1
    while (index >= 0 && end < items.length && Number(items[end].dataset.depth) > depth) end += 1
    const blockBottom = index >= 0 ? top + (end - index) * ROW : 0
    const isRow = this.classList.contains('task-row')
    const bottom = isRow ? top + ROW : blockBottom
    return { top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() { return {} } } as DOMRect
  })
}

async function open() {
  render(<MemoryRouter><TasksPage canEdit configured /></MemoryRouter>)
  // Retry the tab click until the Projects view has loaded its tasks.
  await waitFor(async () => {
    if (!screen.queryByText('Alpha')) {
      await userEvent.click(screen.getByRole('button', { name: /^Projects/ }))
    }
    expect(screen.getByText('Alpha')).toBeTruthy()
  })
}

function order() {
  return Array.from(document.querySelectorAll('.task-item[data-depth="0"] .task-title')).map((el) => el.textContent)
}

describe('reorder within a section', () => {
  it('moves Alpha below Gamma and saves the order', async () => {
    fakeLayout()
    await open()
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
    const list = screen.getByText('Alpha').closest('.task-list') as HTMLElement
    const grip = screen.getByText('Alpha').closest('.task-item')!.querySelector('.task-drag-handle') as HTMLElement
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 0, clientY: 10, pointerType: 'mouse', button: 0 })
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 0, clientY: 100, pointerType: 'mouse' })
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 0, clientY: 175, pointerType: 'mouse' })
    fireEvent.pointerUp(list, { pointerId: 1, clientX: 0, clientY: 175, pointerType: 'mouse' })
    expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])
  })

  it('reorders when the pointer is dropped over a task without indenting', async () => {
    fakeLayout()
    await open()
    const list = screen.getByText('Alpha').closest('.task-list') as HTMLElement
    const grip = screen.getByText('Alpha').closest('.task-item')!.querySelector('.task-drag-handle') as HTMLElement
    fireEvent.pointerDown(grip, { pointerId: 2, clientX: 0, clientY: 10, pointerType: 'mouse', button: 0 })
    // Middle of Beta's row, no indent: a reorder, not a nest.
    fireEvent.pointerMove(list, { pointerId: 2, clientX: 5, clientY: 90, pointerType: 'mouse' })
    fireEvent.pointerUp(list, { pointerId: 2, clientX: 5, clientY: 90, pointerType: 'mouse' })
    expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
    expect(mocks.moveTask).not.toHaveBeenCalled()
  })

  it('reorders subtasks among their siblings and saves the order per parent', async () => {
    window.localStorage.clear()
    mocks.getActiveTasks.mockResolvedValue([
      { ...base, id: 'P', content: 'Alpha' },
      { ...base, id: 'c1', parent_id: 'P', content: 'Child one' },
      { ...base, id: 'c2', parent_id: 'P', content: 'Child two' },
      { ...base, id: 'Q', content: 'Beta' },
    ])
    fakeLayout()
    await open()
    const block = screen.getByText('Alpha').closest('.task-item') as HTMLElement
    const subtaskTitles = () =>
      Array.from(block.querySelectorAll('.task-subtasks > .task-item > .task-row .task-title')).map((el) => el.textContent)
    expect(subtaskTitles()).toEqual(['Child one', 'Child two'])

    const list = screen.getByText('Alpha').closest('.task-list') as HTMLElement
    const grip = screen.getByText('Child two').closest('.task-item')!.querySelector('.task-drag-handle') as HTMLElement
    fireEvent.pointerDown(grip, { pointerId: 3, clientX: 0, clientY: 130, pointerType: 'mouse', button: 0 })
    // Upper half of "Child one": a plain drop between siblings, not a nest.
    fireEvent.pointerMove(list, { pointerId: 3, clientX: 5, clientY: 70, pointerType: 'mouse' })
    fireEvent.pointerUp(list, { pointerId: 3, clientX: 5, clientY: 70, pointerType: 'mouse' })

    expect(subtaskTitles()).toEqual(['Child two', 'Child one'])
    expect(JSON.parse(window.localStorage.getItem('todoist-order:subtasks:P') ?? '[]')).toEqual(['c2', 'c1'])
    expect(mocks.moveTask).not.toHaveBeenCalled()
  })
})
