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

  it('shows the next 24 hours as a row of cards with temperature and rain chance', async () => {
    const user = userEvent.setup()
    const hours = [
      { time: '2026-10-21T15:00', temperature: 71.6, precipitation: 0, precipitationProbability: 10, weatherCode: 0, isDay: true },
      { time: '2026-10-21T16:00', temperature: 70.2, precipitation: 0.12, precipitationProbability: 60, weatherCode: 61, isDay: true },
      { time: '2026-10-22T00:00', temperature: 58.4, precipitation: 0, precipitationProbability: 0, weatherCode: 1, isDay: false },
    ]
    const withForecast: WeatherHook = {
      ...noWeather,
      status: 'ready',
      data: { current: {} as never, hourly: hours, timezone: 'auto' } as unknown as WeatherHook['data'],
    }
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={withForecast} />)

    await user.click(screen.getByRole('tab', { name: 'Hourly' }))

    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(cards[0].getAttribute('aria-label')).toContain('72° Fahrenheit, 10% chance of rain')
    expect(cards[1].getAttribute('aria-label')).toContain('70° Fahrenheit, 60% chance of rain')
    expect(cards[1].textContent).toContain('70°F')
    expect(cards[1].textContent).toContain('60%')
  })

  it('offers a 10 Days page with a city search and a use-my-location button', async () => {
    const user = userEvent.setup()
    const onLocate = vi.fn()
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={{ ...noWeather, retry: onLocate }} />)

    await user.click(screen.getByRole('tab', { name: '10 Days' }))

    expect(screen.getByRole('textbox', { name: 'City' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(onLocate).toHaveBeenCalled()
  })
})

