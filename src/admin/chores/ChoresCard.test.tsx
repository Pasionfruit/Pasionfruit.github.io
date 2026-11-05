// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ listChores: vi.fn(), saveChore: vi.fn(), deleteChore: vi.fn() }))

vi.mock('../../data/backlog/client', () => ({
  listBacklog: vi.fn(async () => []),
  saveBacklogItem: vi.fn(),
  deleteBacklogItem: vi.fn(),
}))

vi.mock('../../data/chores/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/chores/client')>()),
  ...mocks,
}))

import { ChoresCard } from './ChoresCard'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5, 12))
  mocks.saveChore.mockResolvedValue(undefined)
  mocks.listChores.mockResolvedValue([
    { id: '1', name: 'Scoop litter', category: 'cats', intervalDays: 1, lastDone: '2026-11-01' },
    { id: '2', name: 'Wipe counters', category: 'kitchen', intervalDays: 7, lastDone: '2026-11-04' },
    { id: '3', name: 'Wash trash cans', category: 'hygiene', intervalDays: 30, lastDone: '2026-10-20' },
  ])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ChoresCard', () => {
  it('shows last completed and an overdue warning', async () => {
    render(<ChoresCard title="Chores" idToken="t" />)
    const row = (await screen.findByText('Scoop litter')).closest('li') as HTMLElement
    expect(within(row).getByText('Overdue by 3 days')).toBeTruthy()
    expect(within(row).getByText(/Done 4 days ago/)).toBeTruthy()
    const ok = screen.getByText('Wipe counters').closest('li') as HTMLElement
    expect(within(ok).queryByText(/Overdue/)).toBeNull()
  })

  it('filters by category', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    await user.click(screen.getByRole('button', { name: 'Filter by category' }))
    await user.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.queryByText('Scoop litter')).toBeNull()
    expect(screen.getByText('Wipe counters')).toBeTruthy()
  })

  it('combines a time filter with a category filter', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    expect(screen.queryByRole('group', { name: 'Time options' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Filter by how often' }))
    await user.click(within(screen.getByRole('group', { name: 'Time options' })).getByRole('button', { name: 'Weekly' }))
    // Choosing closes the panel and the button now names the choice.
    expect(screen.queryByRole('group', { name: 'Time options' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter by how often' }).getAttribute('title')).toBe('Weekly')
    expect(screen.getByText('Wipe counters')).toBeTruthy()
    expect(screen.queryByText('Scoop litter')).toBeNull()
    expect(screen.queryByText('Wash trash cans')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Filter by category' }))
    await user.click(within(screen.getByRole('group', { name: 'Category options' })).getByRole('button', { name: 'Cats' }))
    expect(screen.queryByText('Wipe counters')).toBeNull()
    expect(screen.getByText('No chores match these filters.')).toBeTruthy()
  })

  it('needs-attention view shows only overdue or never-done chores', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    const toggle = screen.getByRole('button', { name: /Needs attention/ })
    expect(within(toggle).getByText('1')).toBeTruthy()

    await user.click(toggle)
    expect(screen.getByText('Scoop litter')).toBeTruthy()
    expect(screen.queryByText('Wipe counters')).toBeNull()
    expect(screen.queryByText('Wash trash cans')).toBeNull()
  })

  it('marking done saves today and clears the warning', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    await user.click(screen.getByRole('button', { name: 'Mark Scoop litter done' }))
    expect(mocks.saveChore).toHaveBeenCalledWith('t', expect.objectContaining({ id: '1', lastDone: '2026-11-05' }))
    expect(screen.queryByText(/Overdue/)).toBeNull()
  })

  it('edits name, category and frequency, and cancel discards the changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')

    await user.click(screen.getByRole('button', { name: 'Edit Wipe counters' }))
    await user.clear(screen.getByLabelText('Chore name'))
    await user.type(screen.getByLabelText('Chore name'), 'Wipe everything')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Wipe counters')).toBeTruthy()
    expect(mocks.saveChore).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Edit Wipe counters' }))
    await user.clear(screen.getByLabelText('Chore name'))
    await user.type(screen.getByLabelText('Chore name'), 'Wipe everything')
    await user.selectOptions(screen.getByLabelText('Category'), 'hygiene')
    await user.clear(screen.getByLabelText('Repeat every N days'))
    await user.type(screen.getByLabelText('Repeat every N days'), '2')
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(mocks.saveChore).toHaveBeenCalledWith('t', {
      id: '2', name: 'Wipe everything', category: 'hygiene', intervalDays: 2, lastDone: '2026-11-04',
    })
    expect(screen.getByText('Wipe everything')).toBeTruthy()
    expect(screen.queryByText('Wipe counters')).toBeNull()
  })

  it('deletes from the editor', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.deleteChore.mockResolvedValue(undefined)
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    await user.click(screen.getByRole('button', { name: 'Edit Scoop litter' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mocks.deleteChore).toHaveBeenCalledWith('t', '1')
    expect(screen.queryByText('Scoop litter')).toBeNull()
  })

  it('switches to the backlog view and back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChoresCard title="Chores" idToken="t" />)
    await screen.findByText('Scoop litter')
    await user.click(screen.getByRole('button', { name: 'Backlog' }))
    expect(screen.getByLabelText('New backlog item')).toBeTruthy()
    expect(screen.queryByText('Scoop litter')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a chore' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Chores' }))
    expect(screen.getByText('Scoop litter')).toBeTruthy()
  })
})
