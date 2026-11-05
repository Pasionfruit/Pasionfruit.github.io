// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getTrainingRecords: vi.fn(),
  getGarminHealth: vi.fn(),
  listChores: vi.fn(),
  getCompletedTasks: vi.fn(),
}))

vi.mock('../data/sheets/repositories', () => ({
  getJournalEntries: vi.fn(async () => []),
  getGarminWellness: vi.fn(async () => []),
  getRingconnHealth: vi.fn(async () => []),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
  getTrainingRecords: mocks.getTrainingRecords,
  getGarminHealth: mocks.getGarminHealth,
}))

vi.mock('../data/chores/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/chores/client')>()),
  listChores: mocks.listChores,
}))

vi.mock('../data/todoist/repositories', () => ({ getCompletedTasks: mocks.getCompletedTasks }))

import { JournalDashboard } from './JournalDashboard'

const DAY = '2026-11-05'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5, 20))
  mocks.getTrainingRecords.mockResolvedValue([
    { training_id: 't', date: DAY, morning_workout: 'Upper body', completed_morning: true, completed_evening: false },
  ])
  mocks.getGarminHealth.mockResolvedValue([])
  mocks.listChores.mockResolvedValue([
    { id: 'a', name: 'Dishes', category: 'kitchen', intervalDays: 1, lastDone: DAY },
    { id: 'b', name: 'Litter', category: 'cats', intervalDays: 1, lastDone: DAY },
    { id: 'c', name: 'Vacuum', category: 'hygiene', intervalDays: 4, lastDone: '2026-11-01' },
  ])
  mocks.getCompletedTasks.mockResolvedValue([{ id: '1', content: 'Pay rent', priority: 1, is_completed: true }])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function openNewEntry() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<JournalDashboard canWrite idToken="token" />)
  await user.click(await screen.findByRole('button', { name: 'New entry' }))
  return user
}

const entryBox = () => screen.getByPlaceholderText('Short is fine.') as HTMLTextAreaElement

describe('Summarize day', () => {
  it('fills the entry with a workout, chores and tasks bullet for the entry date', async () => {
    const user = await openNewEntry()
    await user.click(screen.getByRole('button', { name: 'Summarize day' }))

    await screen.findByDisplayValue(/Workout: completed Upper body/)
    expect(entryBox().value.split('\n')).toEqual([
      '- Workout: completed Upper body.',
      '- Chores: 2 done (kitchen 1, cats 1).',
      '- Tasks: finished 1 — Pay rent.',
    ])
    expect(mocks.getCompletedTasks).toHaveBeenCalledWith(DAY, DAY)
  })

  it('adds to what is already written, and does not repeat itself', async () => {
    const user = await openNewEntry()
    await user.type(entryBox(), 'Long day.')
    await user.click(screen.getByRole('button', { name: 'Summarize day' }))
    await screen.findByDisplayValue(/Workout/)
    expect(entryBox().value.startsWith('Long day.\n\n- Workout')).toBe(true)

    const before = entryBox().value
    await user.click(screen.getByRole('button', { name: 'Summarize day' }))
    expect(await screen.findByText('Already in your entry.')).toBeTruthy()
    expect(entryBox().value).toBe(before)
  })

  it('still summarises the rest when one dashboard cannot be read, and says which', async () => {
    mocks.getCompletedTasks.mockRejectedValue(new Error('Todoist is not configured'))
    const user = await openNewEntry()
    await user.click(screen.getByRole('button', { name: 'Summarize day' }))

    await screen.findByDisplayValue(/Workout/)
    expect(entryBox().value).not.toContain('Tasks:')
    expect(screen.getByText('Could not read: tasks.')).toBeTruthy()
  })

  it('says so, and writes nothing, when the day has nothing logged', async () => {
    mocks.getTrainingRecords.mockResolvedValue([])
    mocks.listChores.mockResolvedValue([])
    mocks.getCompletedTasks.mockResolvedValue([])
    const user = await openNewEntry()
    await user.click(screen.getByRole('button', { name: 'Summarize day' }))

    expect(await screen.findByText('Nothing logged for that day yet.')).toBeTruthy()
    expect(entryBox().value).toBe('')
  })
})
