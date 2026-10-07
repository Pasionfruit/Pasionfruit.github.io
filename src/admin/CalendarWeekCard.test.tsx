// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const calendarMocks = vi.hoisted(() => ({
  getCalendarEvents: vi.fn(),
}))

vi.mock('../data/sheets/repositories', () => calendarMocks)

import { CalendarWeekCard } from './CalendarWeekCard'

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  vi.stubEnv('VITE_SHEETS_API_BASE_URL', 'https://script.google.com/macros/s/test/exec')
  calendarMocks.getCalendarEvents.mockResolvedValue({ events: [], errors: [], appleConfigured: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('CalendarWeekCard collapse', () => {
  it('folds the month grid away and keeps the event count in the header', async () => {
    const user = userEvent.setup()
    render(<CalendarWeekCard title="Month View" idToken="token" />)

    expect(await screen.findByText('0 events')).toBeTruthy()
    expect(screen.getByLabelText('Calendar view')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Collapse Month View' }))

    expect(screen.queryByLabelText('Calendar view')).toBeNull()
    expect(screen.getByText('0 events')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Expand Month View' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('stays collapsed the next time the dashboard opens', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CalendarWeekCard title="Month View" idToken="token" />)

    await user.click(await screen.findByRole('button', { name: 'Collapse Month View' }))
    unmount()

    render(<CalendarWeekCard title="Month View" idToken="token" />)

    expect(screen.getByRole('button', { name: 'Expand Month View' })).toBeTruthy()
    expect(screen.queryByLabelText('Calendar view')).toBeNull()
  })
})
