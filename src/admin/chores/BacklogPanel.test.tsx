// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
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

  it('shows the due date and time on the right, before the Overdue pill', async () => {
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Renew passport')
    const row = screen.getByText('Renew passport').closest('li') as HTMLElement
    const kids = Array.from(row.children).map((el) => el.className)
    const due = kids.findIndex((c) => c.includes('backlog-due'))
    const overdue = kids.findIndex((c) => c.includes('chore-status'))
    expect(due).toBeGreaterThan(kids.findIndex((c) => c.includes('chore-main')))
    expect(due).toBeLessThan(overdue)
    expect(within(row).getByText('Nov 4')).toBeTruthy()
  })

  it('defaults a new item to an hour from now with no extra steps', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    // The clock is 12:00 noon, so the scheduler already reads Today, 1:00 PM.
    expect((screen.getByLabelText('Due day') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Today')
    expect((screen.getByLabelText('Due time') as HTMLSelectElement).selectedOptions[0].textContent).toBe('1:00 PM')

    await user.type(screen.getByLabelText('New backlog item'), 'Water plants')
    await user.keyboard('{Enter}')

    expect(mocks.saveBacklogItem).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ title: 'Water plants', due: '2026-11-05T13:00' }),
    )
    expect((screen.getByLabelText('New backlog item') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Today, 1:00 PM')).toBeTruthy()
  })

  it('only offers times in the future, and every time again for later days', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    const time = screen.getByLabelText('Due time')
    expect(within(time).queryByRole('option', { name: '9:00 AM' })).toBeNull()
    expect(within(time).queryByRole('option', { name: '12:00 PM' })).toBeNull()
    expect(within(time).getByRole('option', { name: '12:30 PM' })).toBeTruthy()
    expect(within(time).getByRole('option', { name: 'All day' })).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Due day'), 'Tomorrow')
    expect(within(time).getByRole('option', { name: '9:00 AM' })).toBeTruthy()
    expect(within(time).getByRole('option', { name: '12:00 AM' })).toBeTruthy()
  })

  it('picks another day and time, and All day drops the time', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    await user.type(screen.getByLabelText('New backlog item'), 'Pay rent')
    await user.selectOptions(screen.getByLabelText('Due day'), 'Tomorrow')
    await user.selectOptions(screen.getByLabelText('Due time'), '9:30 AM')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(mocks.saveBacklogItem).toHaveBeenLastCalledWith(
      't',
      expect.objectContaining({ title: 'Pay rent', due: '2026-11-06T09:30', done: false }),
    )

    await user.type(screen.getByLabelText('New backlog item'), 'Whole day')
    await user.selectOptions(screen.getByLabelText('Due time'), 'All day')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(mocks.saveBacklogItem).toHaveBeenLastCalledWith(
      't',
      expect.objectContaining({ title: 'Whole day', due: '2026-11-05' }),
    )
  })

  it('moves a picked time that slips into the past to the next one ahead', async () => {
    const user = setup()
    render(<BacklogPanel idToken="t" />)
    await screen.findByText('Buy bulbs')

    await user.selectOptions(screen.getByLabelText('Due time'), '12:30 PM')
    // A minute-tick later than 12:30 makes that choice a past time.
    await act(async () => {
      vi.setSystemTime(new Date(2026, 10, 5, 12, 45))
      vi.advanceTimersByTime(60_000)
    })
    const time = screen.getByLabelText('Due time') as HTMLSelectElement
    expect(time.selectedOptions[0].textContent).toBe('1:00 PM')
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
