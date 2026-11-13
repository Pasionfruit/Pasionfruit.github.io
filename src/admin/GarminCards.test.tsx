// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({ getGarminWellness: vi.fn(), getRingconnHealth: vi.fn(async (): Promise<unknown[]> => []) }))

vi.mock('../data/sheets/repositories', () => repoMocks)

import { GarminWellnessCard } from './GarminCards'
import {
  dailyHealthScores,
  daysBetween,
  gradeOf,
  healthSeries,
  isoWeekRating,
  resolveDate,
  summarise,
  trendNote,
  weekRating,
} from './garmin/wellness'
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
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)

    await screen.findByText('9,000')
    // The date row names the day the numbers are actually from, not today.
    expect(screen.getByText(/No reading for today yet/)).toBeTruthy()
  })

  it('carries sleep & recovery and activity on one card, with no date pill', async () => {
    repoMocks.getGarminWellness.mockResolvedValue([
      row(YESTERDAY, { sleep_score: '81', steps: '9000' }),
      row(TWO_DAYS_AGO, { sleep_score: '74', steps: '6000' }),
    ])
    const { container } = render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)

    const sleep = await screen.findByRole('region', { name: 'Sleep & recovery' })
    const activity = screen.getByRole('region', { name: 'Activity' })

    expect(within(sleep).getByText('Sleep score')).toBeTruthy()
    expect(within(sleep).getByText('81')).toBeTruthy()
    expect(within(activity).getByText('9,000')).toBeTruthy()
    expect(container.querySelector('.admin-pill')).toBeNull()
  })

  it('averages both groups by week from one toggle', async () => {
    const user = userEvent.setup()
    // A Tuesday and Wednesday, so both fall in the same week however weeks start.
    repoMocks.getGarminWellness.mockResolvedValue([
      row('2026-09-02', { sleep_score: '80', steps: '8000' }),
      row('2026-09-01', { sleep_score: '70', steps: '6000' }),
    ])
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)

    await screen.findByText('8,000')
    await user.click(screen.getByRole('button', { name: 'Week avg' }))

    const sleep = screen.getByRole('region', { name: 'Sleep & recovery' })
    const activity = screen.getByRole('region', { name: 'Activity' })
    expect(within(sleep).getByText('75')).toBeTruthy()
    expect(within(activity).getByText('7,000')).toBeTruthy()
  })

  it('steps back to a previous day and back to the latest', async () => {
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)

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
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)

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
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)
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

  it('switches to the RingConn ring and back, each with its own numbers', async () => {
    repoMocks.getRingconnHealth.mockResolvedValue([
      {
        date: YESTERDAY, sleep_score: '', sleep_duration_h: '', deep_sleep_h: '', rem_sleep_h: '',
        light_sleep_h: '', resting_hr: '55', hrv: '', skin_temp_c: '', steps: '5390', calories: '424',
      },
    ])
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" defaultCollapsed={false} />)
    await screen.findByText('9,000')

    const source = screen.getByRole('group', { name: 'Data source' })
    await user.click(within(source).getByRole('button', { name: 'RingConn' }))

    expect(await screen.findByText('5,390')).toBeTruthy()
    expect(screen.getByText('Active energy')).toBeTruthy()
    expect(screen.queryByText('9,000')).toBeNull()
    // The ring has no HRV to show.
    expect(screen.queryByText('HRV')).toBeNull()
    // Sleep was never recorded: a dash, not a zero.
    expect(screen.getByText('Time asleep').parentElement?.textContent).toContain('—')

    // The panel remounts per source, so the switch has to be found again.
    const again = screen.getByRole('group', { name: 'Data source' })
    await user.click(within(again).getByRole('button', { name: 'Garmin' }))
    expect(await screen.findByText('9,000')).toBeTruthy()
  })
})

describe('GarminWellnessCard collapsed', () => {
  it('starts collapsed as a one-line trend note, with no grid and no controls', async () => {
    render(<GarminWellnessCard title="Daily wellness" />)

    const note = await screen.findByRole('status')
    expect(note.textContent).toMatch(/^Trending well — steps ▲ 9,000/)
    expect(screen.getByRole('button', { name: 'Expand Daily wellness' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Data source' })).toBeNull()
  })

  it('expands into the full view with sparklines, and stays open when the source switches', async () => {
    repoMocks.getGarminWellness.mockResolvedValue([
      row(YESTERDAY, { steps: '9000' }),
      row(TWO_DAYS_AGO, { steps: '6000' }),
      row(addDaysToKey(TODAY, -3), { steps: '5000' }),
    ])
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" />)

    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: 'Expand Daily wellness' }))

    const activity = await screen.findByRole('region', { name: 'Activity' })
    expect(within(activity).getByText('9,000')).toBeTruthy()
    expect(activity.querySelector('.garmin-sparkline')).toBeTruthy()

    await user.click(within(screen.getByRole('group', { name: 'Data source' })).getByRole('button', { name: 'RingConn' }))
    expect(screen.getByRole('button', { name: 'Collapse Daily wellness' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Collapse Daily wellness' }))
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('says so when nothing has been read yet', async () => {
    repoMocks.getGarminWellness.mockResolvedValue([])
    render(<GarminWellnessCard title="Daily wellness" />)

    expect((await screen.findByRole('status')).textContent).toBe('No readings yet.')
  })
})

describe('trendNote', () => {
  const metrics = [
    { key: 'sleep_score' as const, label: 'Sleep score', higherIsBetter: true },
    { key: 'resting_hr' as const, label: 'Resting HR', higherIsBetter: false },
  ]

  it('calls it trending well when more metrics moved the right way', () => {
    const rows = [
      row(YESTERDAY, { sleep_score: '85', resting_hr: '52' }),
      row(TWO_DAYS_AGO, { sleep_score: '70', resting_hr: '56' }),
      row(addDaysToKey(TODAY, -3), { sleep_score: '72', resting_hr: '57' }),
    ]
    expect(trendNote(rows, metrics)).toEqual({ tone: 'good', text: 'Trending well — sleep score ▲ 85, resting HR ▼ 52' })
  })

  it('calls it slipping when more moved the wrong way', () => {
    const rows = [
      row(YESTERDAY, { sleep_score: '60', resting_hr: '62' }),
      row(TWO_DAYS_AGO, { sleep_score: '78', resting_hr: '55' }),
      row(addDaysToKey(TODAY, -3), { sleep_score: '80', resting_hr: '54' }),
    ]
    expect(trendNote(rows, metrics).tone).toBe('bad')
    expect(trendNote(rows, metrics).text).toMatch(/^Slipping — /)
  })

  it('holds steady when nothing moved more than a few percent, and says when there is no data', () => {
    const rows = [row(YESTERDAY, { sleep_score: '80' }), row(TWO_DAYS_AGO, { sleep_score: '80' })]
    expect(trendNote(rows, metrics)).toEqual({ tone: 'flat', text: 'Holding steady — sleep score 80' })
    expect(trendNote([], metrics)).toEqual({ tone: 'none', text: 'No readings yet.' })
  })
})

describe('health rating', () => {
  it('maps a score to A–F at 90, 80, 70 and 60', () => {
    expect([95, 90, 89, 80, 79, 70, 69, 60, 59, 0].map(gradeOf)).toEqual(['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F'])
  })

  it('averages the readings a day has, and needs at least two', () => {
    // Sleep 90, steps 10,000 (100) and stress 20 (80): mean 90.
    const rich = row(YESTERDAY, { sleep_score: '90', steps: '10000', stress_avg: '20' })
    expect(dailyHealthScores([rich])).toEqual([{ date: YESTERDAY, score: 90, grade: 'A' }])

    // One reading is not a rating.
    expect(dailyHealthScores([row(YESTERDAY, { steps: '9000' })])).toEqual([])
  })

  it('uses hours asleep only when there is no sleep score, and judges HRV against your own average', () => {
    expect(dailyHealthScores([row(YESTERDAY, { sleep_duration_h: '8', stress_avg: '0' })])[0].score).toBe(100)
    // Sleep score present: hours are not counted a second time.
    expect(dailyHealthScores([row(YESTERDAY, { sleep_score: '80', sleep_duration_h: '2', stress_avg: '20' })])[0].score).toBe(80)

    // HRV 10% under the fortnight's 50 costs 20 points: 80, against a 100 sleep score.
    const baseline = [1, 2, 3].map((n) => row(addDaysToKey(TODAY, -n - 1), { hrv: '50' }))
    const today = row(YESTERDAY, { hrv: '45', sleep_score: '100' })
    expect(dailyHealthScores([today, ...baseline])[0].score).toBe(90)
  })

  it('leaves out a day still in progress from steps, so a morning does not read as a bad day', () => {
    const rows = [row(TODAY, { steps: '800', sleep_score: '88', stress_avg: '22' })]
    expect(dailyHealthScores(rows, TODAY)[0].score).toBe(83)
    expect(dailyHealthScores(rows, '')[0].score).toBeLessThan(83)
  })

  it('rates the week from the seven days to a date, and the calendar week from its Monday', () => {
    const scores = [
      { date: '2026-09-09', score: 90, grade: 'A' as const },
      { date: '2026-09-08', score: 80, grade: 'B' as const },
      { date: '2026-09-01', score: 40, grade: 'F' as const },
    ]
    expect(weekRating(scores, '2026-09-09')).toEqual({ score: 85, grade: 'B', days: 2 })
    // 2026-09-07 is a Monday: that week holds the 8th and 9th.
    expect(isoWeekRating(scores, '2026-09-07')).toEqual({ score: 85, grade: 'B', days: 2 })
    expect(weekRating([], '2026-09-09')).toBeNull()
  })

  it('draws the trendline oldest first, by day or averaged by week', () => {
    const scores = [
      { date: '2026-09-09', score: 90, grade: 'A' as const },
      { date: '2026-09-08', score: 80, grade: 'B' as const },
      { date: '2026-09-01', score: 70, grade: 'C' as const },
    ]
    expect(healthSeries(scores, 'day').map((point) => point.score)).toEqual([70, 80, 90])
    expect(healthSeries(scores, 'week')).toEqual([
      { label: '2026-08-31', score: 70 },
      { label: '2026-09-07', score: 85 },
    ])
  })

  it('shows the day and week ratings with a trendline when expanded, and a grade in the collapsed line', async () => {
    const user = userEvent.setup()
    // Four days of sleep score + steps, newest first, all complete days.
    repoMocks.getGarminWellness.mockResolvedValue(
      [1, 2, 3, 4].map((n) => row(addDaysToKey(TODAY, -n), { sleep_score: String(95 - n), steps: '10000' })),
    )
    render(<GarminWellnessCard title="Daily wellness" />)

    const note = await screen.findByRole('status')
    expect(note.querySelector('.garmin-grade')?.textContent).toBe('A')
    expect(note.textContent).toContain('Week A')

    await user.click(screen.getByRole('button', { name: 'Expand Daily wellness' }))
    const health = await screen.findByRole('region', { name: 'Health rating' })
    expect(within(health).getByText('Day')).toBeTruthy()
    expect(within(health).getByText(/\/100 · 4 days/)).toBeTruthy()
    expect(health.querySelector('svg.garmin-trendline')).toBeTruthy()
  })

  it('puts the source and period switches on the left of the header, and the refresh by the collapse button', async () => {
    const user = userEvent.setup()
    render(<GarminWellnessCard title="Daily wellness" />)
    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: 'Expand Daily wellness' }))

    const head = document.querySelector('.admin-card-head') as HTMLElement
    const lead = head.querySelector('.garmin-head-lead') as HTMLElement
    const actions = head.querySelector('.admin-card-actions') as HTMLElement
    expect(within(lead).getByRole('group', { name: 'Data source' })).toBeTruthy()
    expect(within(lead).getByRole('group', { name: 'Averaging period' })).toBeTruthy()
    expect(within(actions).getByRole('button', { name: /Refresh/ })).toBeTruthy()
    expect(within(actions).getByRole('button', { name: 'Collapse Daily wellness' })).toBeTruthy()
  })

  it('puts the collapsed note in the header, beside the collapse button', async () => {
    render(<GarminWellnessCard title="Daily wellness" />)
    const note = await screen.findByRole('status')

    expect(note.closest('.admin-card-head')).toBeTruthy()
    expect(note.closest('.admin-card-head')?.querySelector('.section-collapse-btn')).toBeTruthy()
  })
})
