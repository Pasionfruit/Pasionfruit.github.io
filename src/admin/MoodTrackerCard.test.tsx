// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GarminWellnessRecord, JournalEntryRecord } from '../data/sheets/types'

const repoMocks = vi.hoisted(() => ({ getGarminWellness: vi.fn() }))
vi.mock('../data/sheets/repositories', () => repoMocks)

import { MoodTrackerCard } from './MoodTrackerCard'

function dayKey(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function entry(daysAgo: number, mood: string): JournalEntryRecord {
  return {
    journal_id: `j${daysAgo}`,
    entry_date: dayKey(daysAgo),
    title: '',
    mood,
    body: '',
    gratitude: [],
    prompt: '',
    reflection: '',
    tags: [],
    created_at: '',
  }
}

function sleep(daysAgo: number, hours: string) {
  return { date: dayKey(daysAgo), sleep_duration_h: hours } as GarminWellnessRecord
}

beforeEach(() => {
  repoMocks.getGarminWellness.mockResolvedValue([sleep(0, '7.5'), sleep(1, '5.5')])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MoodTrackerCard', () => {
  it('charts mood against hours of sleep, with the same numbers in a table for screen readers', async () => {
    render(<MoodTrackerCard title="Mood" entries={[entry(0, 'Good'), entry(1, 'Tired')]} isLoading={false} />)

    expect(screen.getByRole('img', { name: /Mood and hours of sleep/ })).toBeTruthy()
    expect(await screen.findByText('Sleep · avg 6.5 h')).toBeTruthy()

    const table = screen.getByRole('table', { name: /Mood and hours of sleep/ })
    const today = within(table).getByRole('row', { name: new RegExp(dayKey(0)) })
    expect(within(today).getByText('Good')).toBeTruthy()
    expect(within(today).getByText('7.5 h')).toBeTruthy()
  })

  it('still charts sleep when no moods were logged', async () => {
    render(<MoodTrackerCard title="Mood" entries={[]} isLoading={false} />)

    expect(await screen.findByText(/so this is sleep alone/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Mood and hours of sleep/ })).toBeTruthy()
  })

  it('says so when there is neither mood nor sleep, and survives the sleep sheet failing', async () => {
    repoMocks.getGarminWellness.mockRejectedValue(new Error('sheet down'))
    render(<MoodTrackerCard title="Mood" entries={[]} isLoading={false} />)

    expect(await screen.findByText('No moods or sleep logged in the last 30 days.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('filters the window to 7, 14, or 30 days', async () => {
    const user = userEvent.setup()
    render(<MoodTrackerCard title="Mood" entries={[entry(0, 'Good'), entry(10, 'Tired')]} isLoading={false} />)

    const table = await screen.findByRole('table', { name: /Mood and hours of sleep/ })
    expect(within(table).getByRole('row', { name: new RegExp(dayKey(10)) })).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: '7 days' }))
    expect(screen.getByRole('tab', { name: '7 days' }).getAttribute('aria-selected')).toBe('true')
    expect(within(table).queryByRole('row', { name: new RegExp(dayKey(10)) })).toBeNull()
    expect(within(table).getByRole('row', { name: new RegExp(dayKey(0)) })).toBeTruthy()
    expect(screen.getByRole('img', { name: /over the last 7 days/ })).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: '14 days' }))
    expect(within(table).getByRole('row', { name: new RegExp(dayKey(10)) })).toBeTruthy()
    expect(screen.getByRole('img', { name: /over the last 14 days/ })).toBeTruthy()
  })
})

