// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JournalEntryRecord } from '../data/sheets/types'
import { JournalDashboard } from './JournalDashboard'

const ENTRY: JournalEntryRecord = {
  journal_id: 'j1',
  entry_date: '2026-10-05',
  title: 'A quiet Sunday',
  mood: 'Good',
  body: 'Long walk.',
  gratitude: [],
  prompt: '',
  reflection: '',
  tags: ['family', 'rest'],
  created_at: '2026-10-05T20:00:00Z',
}

vi.mock('../data/sheets/repositories', () => ({
  getJournalEntries: vi.fn(async () => [ENTRY]),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
}))

// The sleep card fetches Garmin data of its own; it has no part in this.
vi.mock('./GarminCards', () => ({ GarminSleepCard: () => null }))

// SHA-256 of 'pw'.
const PASSWORD_HASH = '30c952fab122c3f9759f02a6d95c3758b246b4fee239957b2d4fee46e26170c4'

beforeEach(() => {
  vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('JournalDashboard', () => {
  it('keeps past entries locked but still lets the admin start a new one', async () => {
    const user = userEvent.setup()
    render(<JournalDashboard canWrite idToken="token" />)

    expect(await screen.findByRole('heading', { name: 'Entries are locked' })).toBeTruthy()
    expect(screen.queryByText(ENTRY.title)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'New entry' }))

    expect(screen.getByRole('button', { name: 'Add entry' })).toBeTruthy()
    // Opening the editor must not unlock, or re-lock, the entries below it.
    expect(screen.getByRole('heading', { name: 'Entries are locked' })).toBeTruthy()
  })

  it('puts the entries directly under the verse of the day', async () => {
    render(<JournalDashboard canWrite idToken="token" />)

    const verse = screen.getByRole('heading', { name: 'Verse of the day' })
    const entries = screen.getByRole('heading', { name: 'Entries' })
    const mood = screen.getByRole('heading', { name: 'Mood' })

    expect(verse.compareDocumentPosition(entries) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(entries.compareDocumentPosition(mood) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await screen.findByRole('heading', { name: 'Entries are locked' })
  })

  it('shows the entry once unlocked, with no tag filter above it', async () => {
    const user = userEvent.setup()
    render(<JournalDashboard canWrite idToken="token" />)

    await user.type(await screen.findByLabelText('Journal password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText(ENTRY.title)).toBeTruthy()
    // Tags still show on the entry itself, but not as filter buttons.
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'family' })).toBeNull()
    expect(screen.getByText('family')).toBeTruthy()
  })
})
