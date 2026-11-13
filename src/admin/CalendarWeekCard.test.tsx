// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const calendarMocks = vi.hoisted(() => ({
  getCalendarEvents: vi.fn(),
}))

vi.mock('../data/sheets/repositories', () => calendarMocks)

const todoistMocks = vi.hoisted(() => ({
  getActiveTasks: vi.fn(),
  getProjects: vi.fn(),
  getSections: vi.fn(),
  createTaskDetailed: vi.fn(),
  updateTask: vi.fn(),
  rescheduleTask: vi.fn(),
  closeTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../data/todoist/repositories', () => todoistMocks)

import { CalendarWeekCard } from './CalendarWeekCard'
import type { WeatherHook } from '../weather/useWeather'
import { addDaysToKey, todayKey } from '../data/todoist/dates'

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
  todoistMocks.getActiveTasks.mockResolvedValue([])
  todoistMocks.getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Inbox', is_inbox_project: true, child_order: 0 }])
  todoistMocks.getSections.mockResolvedValue([])
  todoistMocks.closeTask.mockResolvedValue(undefined)
  todoistMocks.createTaskDetailed.mockResolvedValue(task({ id: 'new-1', content: 'Fresh task' }))
})

function task(overrides: Record<string, unknown>) {
  return {
    id: 'task-1',
    parent_id: null,
    project_id: 'proj-1',
    section_id: null,
    content: 'A task',
    description: '',
    labels: [],
    priority: 4,
    is_completed: false,
    child_order: 0,
    due: null,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('CalendarWeekCard', () => {
  it('is not collapsible and keeps the event count in the header', async () => {
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    expect(await screen.findByText('0 events')).toBeTruthy()
    expect(screen.getByLabelText('Calendar view')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Collapse|Expand/ })).toBeNull()
  })

  it('shows the selected day below the calendar instead of in a popup', async () => {
    const user = userEvent.setup()
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    await screen.findByLabelText('Calendar view')

    // Today is already open on arrival.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Nothing scheduled.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Nothing scheduled.')).toBeNull()
  })

  it('opens on today, showing the day\'s activity without a tap', async () => {
    const today = todayKey()
    calendarMocks.getCalendarEvents.mockResolvedValue({
      events: [
        {
          id: 'e1',
          source: 'google',
          title: 'Dentist',
          start: `${today}T09:00:00`,
          end: `${today}T10:00:00`,
          allDay: false,
          location: '',
          calendarName: 'Personal',
        },
      ],
      errors: [],
      appleConfigured: true,
    })
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

    expect(await screen.findByText('Dentist')).toBeTruthy()
    const todayCell = (await screen.findByLabelText('Calendar view')).querySelector('.is-today')
    expect(todayCell?.getAttribute('aria-pressed')).toBe('true')
  })

  it('gives the selected day the same task controls as Upcoming: add, complete', async () => {
    const user = userEvent.setup()
    const today = todayKey()
    todoistMocks.getActiveTasks.mockResolvedValue([
      task({ id: 'today-1', content: 'Standup notes', priority: 2, due: { date: today } }),
      task({ id: 'later-1', content: 'Quarterly review', due: { date: addDaysToKey(today, 1) } }),
    ])
    render(
      <CalendarWeekCard
        title="Calendar and Weather"
        idToken="token"
        weather={noWeather}
        todoistConfigured
        canEditTasks
      />,
    )

    expect(await screen.findByText('Standup notes')).toBeTruthy()
    expect(screen.queryByText('Quarterly review')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await user.type(screen.getByLabelText('New task name'), 'Fresh task')
    // The new task defaults to the selected day.
    expect((screen.getByLabelText('New task due date') as HTMLInputElement).value).toBe(today)
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await waitFor(() =>
      expect(todoistMocks.createTaskDetailed).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Fresh task', dueDate: today }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Complete Standup notes' }))
    await waitFor(() => expect(todoistMocks.closeTask).toHaveBeenCalledWith('today-1'))
  })

  it('shows tasks read-only, with no add form, when the account cannot edit', async () => {
    todoistMocks.getActiveTasks.mockResolvedValue([
      task({ id: 'today-1', content: 'Standup notes', due: { date: todayKey() } }),
    ])
    render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} todoistConfigured />)

    expect(await screen.findByText('Standup notes')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add task/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Complete Standup notes' })).toHaveProperty('disabled', true)
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

  it('shows a multi-day all-day event on every day it covers and not the day before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 5, 12))
    try {
      calendarMocks.getCalendarEvents.mockResolvedValue({
        events: [
          {
            id: 'trip', source: 'google', title: 'Trip', start: '2026-11-08', end: '2026-11-11',
            allDay: true, location: '', calendarName: '',
          },
        ],
        errors: [],
        appleConfigured: true,
      })
      render(<CalendarWeekCard title="Calendar and Weather" idToken="token" weather={noWeather} />)

      expect(await screen.findByLabelText('2026-11-08 has 1 event')).toBeTruthy()
      expect(screen.getByLabelText('2026-11-09 has 1 event')).toBeTruthy()
      expect(screen.getByLabelText('2026-11-10 has 1 event')).toBeTruthy()
      expect(screen.getByLabelText('2026-11-07 has no events')).toBeTruthy()
      expect(screen.getByLabelText('2026-11-11 has no events')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
