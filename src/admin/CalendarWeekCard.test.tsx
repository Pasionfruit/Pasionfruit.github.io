// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const calendarMocks = vi.hoisted(() => ({
  getCalendarEvents: vi.fn(),
}))

vi.mock('../data/sheets/repositories', () => calendarMocks)

import { CalendarWeekCard } from './CalendarWeekCard'
import type { WeatherHook } from '../weather/useWeather'

// No location yet: the radar and hourly pages show their waiting messages.
const noWeather: WeatherHook = {
  status: 'error',
  coords: null,
  place: '',
  data: null,
  aqi: null,
  error: '',
  refresh: () => {},
  retry: () => {},
}

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
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    expect(await screen.findByText('0 events')).toBeTruthy()
    expect(screen.getByLabelText('Calendar view')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Collapse Calendar and Weather' }))

    expect(screen.queryByLabelText('Calendar view')).toBeNull()
    expect(screen.getByText('0 events')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Expand Calendar and Weather' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('stays collapsed the next time the dashboard opens', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    await user.click(await screen.findByRole('button', { name: 'Collapse Calendar and Weather' }))
    unmount()

    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    expect(screen.getByRole('button', { name: 'Expand Calendar and Weather' })).toBeTruthy()
    expect(screen.queryByLabelText('Calendar view')).toBeNull()
  })

  it('shows the radar and hourly forecast as pages of the month view', async () => {
    const user = userEvent.setup()
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    expect(await screen.findByLabelText('Calendar view')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Radar' }))
    expect(screen.queryByLabelText('Calendar view')).toBeNull()
    expect(screen.getByText('Location unavailable — radar needs your position.')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Hourly' }))
    expect(screen.getByText('The hourly forecast loads with the weather.')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))
    expect(screen.getByLabelText('Calendar view')).toBeTruthy()
  })
})
