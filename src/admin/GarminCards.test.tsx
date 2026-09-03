// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({ getGarminWellness: vi.fn() }))

vi.mock('../data/sheets/repositories', () => repoMocks)

import { GarminWellnessCard } from './GarminCards'
import { daysBetween, resolveDate, summarise } from './garmin/wellness'
import { addDaysToKey, todayKey } from '../data/todoist/dates'
import type { GarminWellnessRecord } from '../data/sheets/types'

const TODAY = todayKey()
const YESTERDAY = addDaysToKey(TODAY, -1)
const TWO_DAYS_AGO = addDaysToKey(TODAY, -2)

function row(date: string, overrides: Partial<GarminWellnessRecord> = {}): GarminWellnessRecord {
  return {
    date,
    sleep_score: '',
    sleep_duration_h: '',
    deep_sleep_h: '',
    rem_sleep_h: '',
    light_sleep_h: '',
    awake_h: '',
    resting_hr: '',
    hrv: '',
    body_battery_high: '',
    stress_avg: '',
    respiration_avg: '',
    steps: '',
    intensity_minutes: '',
    calories: '',
    vo2_max: '',
    training_readiness: '',
    training_status: '',
    endurance_score: '',
    ...overrides,
  }
}

// Newest first, the order getGarminWellness returns.
const ROWS = [
  row(YESTERDAY, { steps: '9000', calories: '2200' }),
  row(TWO_DAYS_AGO, { steps: '6000', calories: '2000', stress_avg: '28' }),
]

beforeEach(() => {
  vi.clearAllMocks()
  repoMocks.getGarminWellness.mockResolvedValue(ROWS)
})

afterEach(() => {
  cleanup()
})

describe('summarise', () => {
  it('flags a value carried from an older day than the one being shown', () => {
    // Avg stress has no reading on the anchor day, only two days ago.
    const stress = summarise(ROWS, { key: 'stress_avg', label: 'Avg stress' })
    expect(stress?.latest.value).toBe(28)
    expect(stress?.latest.date).toBe(TWO_DAYS_AGO)
    expect(stress?.carried).toBe(true)
  })

  it('does not flag a value that belongs to the day being shown', () => {
    const steps = summarise(ROWS, { key: 'steps', label: 'Steps' })
    expect(steps?.latest.value).toBe(9000)
    expect(steps?.carried).toBe(false)
  })

  it('returns null when no day has the metric', () => {
    expect(summarise(ROWS, { key: 'vo2_max', label: 'VO2 max' })).toBeNull()
  })
})

describe('resolveDate', () => {
  const dates = [YESTERDAY, TWO_DAYS_AGO]

  it('defaults to the newest day', () => {
    expect(resolveDate(dates, '')).toBe(YESTERDAY)
  })

  it('snaps a day with no reading back to the closest older one', () => {
    expect(resolveDate(dates, TODAY)).toBe(YESTERDAY)
  })

  it('falls back to the oldest day when the wanted day precedes them all', () => {
    expect(resolveDate(dates, '2020-01-01')).toBe(TWO_DAYS_AGO)
  })
})

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-08-30', '2026-09-02')).toBe(3)
  })

  it('is zero for the same day and for unparseable input', () => {
    expect(daysBetween('2026-09-02', '2026-09-02')).toBe(0)
    expect(daysBetween('', '2026-09-02')).toBe(0)
  })
})

describe('GarminWellnessCard', () => {
  it('shows the newest day and says how stale it is', async () => {
    render(<GarminWellnessCard title="Daily wellness" />)

    await screen.findByText('9,000')
    // The pill names the day the numbers are actually from, not today.
    expect(screen.getByText(/No reading for today yet/)).toBeTruthy()
  })

  it('steps back to a previous day and back to the latest', async () => {
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" />)

    await screen.findByText('9,000')

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('6,000')).toBeTruthy()

    // Stepping back reaches the oldest row, so there is nowhere further to go.
    expect(screen.getByRole('button', { name: 'Previous day' })).toHaveProperty('disabled', true)

    await user.click(screen.getByRole('button', { name: 'Latest' }))
    expect(await screen.findByText('9,000')).toBeTruthy()
  })

  it('names the day a carried-forward value came from', async () => {
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" />)

    await screen.findByText('9,000')

    // Avg stress is only recorded two days ago, so on the newest day it is
    // borrowed and must say so rather than reading as that day's measurement.
    const stress = screen.getByText('Avg stress').closest('.garmin-metric')
    if (!stress) throw new Error('Avg stress metric not rendered')
    expect(within(stress as HTMLElement).getByText(/^from /)).toBeTruthy()

    // On the day it belongs to, the note is gone.
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() => {
      const cell = screen.getByText('Avg stress').closest('.garmin-metric') as HTMLElement
      expect(within(cell).queryByText(/^from /)).toBeNull()
    })
  })

  it('refetches when the app returns to the foreground', async () => {
    render(<GarminWellnessCard title="Daily wellness" />)
    await waitFor(() => expect(repoMocks.getGarminWellness).toHaveBeenCalledTimes(1))

    // What an iPhone PWA does on resume: no remount, so a mount-only fetch
    // would leave the card showing whatever it read days ago.
    repoMocks.getGarminWellness.mockResolvedValue([
      row(TODAY, { steps: '12345', calories: '2400' }),
      ...ROWS,
    ])

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(repoMocks.getGarminWellness).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('12,345')).toBeTruthy()
    expect(screen.queryByText(/No reading for today yet/)).toBeNull()
  })
})
