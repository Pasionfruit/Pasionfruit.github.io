// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ listBacklog: vi.fn(), saveBacklogItem: vi.fn(), deleteBacklogItem: vi.fn() }))

vi.mock('../../data/backlog/client', () => mocks)

import { BacklogPanel } from './BacklogPanel'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date(2026, 10, 5, 12))
  mocks.saveBacklogItem.mockResolvedValue(undefined)
  mocks.deleteBacklogItem.mockResolvedValue(undefined)
  mocks.listBacklog.mockResolvedValue([
    { id: 'a', title: 'Renew passport', due: '2026-11-04', done: false, createdAt: '2026-11-01T00:00:00Z' },
    { id: 'b', title: 'Call dentist', due: '2026-11-07T15:00', done: false, createdAt: '2026-11-02T00:00:00Z' },
    { id: 'c', title: 'Buy bulbs', due: '', done: false, createdAt: '2026-11-03T00:00:00Z' },
  ])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

describe('BacklogPanel', () => {
  it('lists soonest first, undated last, and warns on overdue', async () => {
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Renew passport')
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('.chore-name')?.textContent)
    expect(names).toEqual(['Renew passport', 'Call dentist', 'Buy bulbs'])
    const overdue = screen.getByText('Renew passport').closest('li') as HTMLElement
    expect(within(overdue).getByText('Overdue')).toBeTruthy()
    const later = screen.getByText('Call dentist').closest('li') as HTMLElement
    expect(within(later).queryByText('Overdue')).toBeNull()
    expect(within(later).getByText(/Nov 7/)).toBeTruthy()
  })

  it('jots an item with Enter and saves it with a date and time', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    await user.type(screen.getByLabelText('New backlog item'), 'Pay rent')
    await user.click(screen.getByRole('button', { name: 'Set a due date and time' }))
    await user.type(screen.getByLabelText('Due date'), '2026-11-06')
    await user.type(screen.getByLabelText('Due time'), '09:30')
    await user.keyboard('{Enter}')

    expect(mocks.saveBacklogItem).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ title: 'Pay rent', due: '2026-11-06T09:30', done: false }),
    )
    expect(screen.getByText('Pay rent')).toBeTruthy()
    expect((screen.getByLabelText('New backlog item') as HTMLInputElement).value).toBe('')
  })

  it('completes, clears done items, and removes', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    await user.click(screen.getByRole('button', { name: 'Complete Buy bulbs' }))
    expect(mocks.saveBacklogItem).toHaveBeenCalledWith('t', expect.objectContaining({ id: 'c', done: true }))

    await user.click(screen.getByRole('button', { name: 'Clear 1 done' }))
    expect(mocks.deleteBacklogItem).toHaveBeenCalledWith('t', 'c')
    expect(screen.queryByText('Buy bulbs')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Remove Call dentist' }))
    expect(mocks.deleteBacklogItem).toHaveBeenCalledWith('t', 'b')
  })

  it('rolls back and shows an error when a save fails', async () => {
    const user = setup()
    mocks.saveBacklogItem.mockRejectedValue(new Error('Invalid token'))
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')
    await user.type(screen.getByLabelText('New backlog item'), 'Doomed')
    await user.keyboard('{Enter}')
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid token')
    expect(screen.queryByText('Doomed')).toBeNull()
  })
})
