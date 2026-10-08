import { describe, expect, it } from 'vitest'
import { discipline, hasAnyData, renderAceContext, sheetDateKey, type AceContext } from './context'
import type { TodoistTask } from '../../data/todoist/types'
import type { GarminWellnessRecord } from '../../data/sheets/types'

function context(overrides: Partial<AceContext> = {}): AceContext {
  return {
    now: new Date('2026-08-31T09:00:00'),
    mail: [],
    events: [],
    tasksToday: [],
    tasksOverdue: [],
    completedYesterday: [],
    completedToday: [],
    slippedYesterday: [],
    tasksTomorrow: [],
    wellness: null,
    wellnessHistory: [],
    activities: [],
    trainingPlan: [],
    races: [],
    milestones: [],
    journal: [],
    gaps: [],
    ...overrides,
  }
}

const TASK = {
  id: 't-1',
  content: 'Renew passport',
  priority: 1,
  due: { date: '2026-08-31' },
} as unknown as TodoistTask

function night(date: string, values: Partial<GarminWellnessRecord>): GarminWellnessRecord {
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
    ...values,
  }
}

describe('renderAceContext', () => {
  it('states plainly that there is no data when every source is empty', () => {
    const empty = context({ gaps: ['Gmail', 'Calendar'] })

    expect(hasAnyData(empty)).toBe(false)

    const text = renderAceContext(empty)
    expect(text).toContain('## No data for today')
    expect(text).toContain('Do not list, summarise, or invent any items.')
    // The unreachable sources are still named so the model knows why.
    expect(text).toContain('Gmail, Calendar')
    // No per-section "Nothing…" template for the model to fill in.
    expect(text).not.toContain('## Due today')
    expect(text).not.toContain("## Today's schedule")
  })

  it('renders the sections when there is something to report', () => {
    const withTask = context({ tasksToday: [TASK] })

    expect(hasAnyData(withTask)).toBe(true)

    const text = renderAceContext(withTask)
    expect(text).toContain('## Due today')
    expect(text).toContain('- Renew passport (due 2026-08-31)')
    expect(text).not.toContain('## No data for today')
  })

  it('hands the model a computed sleep baseline instead of leaving it the arithmetic', () => {
    const history = [
      night('2026-08-31', { sleep_score: '85', hrv: '75', resting_hr: '53' }),
      night('2026-08-30', { sleep_score: '75', hrv: '55', resting_hr: '57' }),
    ]
    const text = renderAceContext(context({ wellness: history[0], wellnessHistory: history }))

    expect(text).toContain('## Sleep and recovery, last 2 nights')
    expect(text).toContain('Averages (his baseline): sleep score 80, HRV 65ms, resting HR 55bpm.')
    expect(text).toContain('- 2026-08-31: sleep 85, HRV 75, RHR 53')
  })

  it('totals training by discipline per week and counts down to the goal race', () => {
    const text = renderAceContext(
      context({
        activities: [
          { date: '2026-08-30', activity_type: 'lap_swimming', title: 'Pool Swim', distance_mi: '0.5', duration_min: '25', avg_hr: '140', max_hr: '', calories: '', tss: '', activity_id: '' },
          { date: '2026-08-29', activity_type: 'running', title: 'Easy Run', distance_mi: '4', duration_min: '40', avg_hr: '150', max_hr: '', calories: '', tss: '', activity_id: '' },
          { date: '2026-08-28', activity_type: 'treadmill_running', title: 'Treadmill', distance_mi: '3', duration_min: '30', avg_hr: '', max_hr: '', calories: '', tss: '', activity_id: '' },
        ],
        races: [
          { event_id: '2', event_date: '10/10/2026 6:30:00', event_name: 'Half Marathon' },
          { event_id: '5', event_date: 'TBD', event_name: 'Campeche 70.3' },
        ],
      }),
    )

    // Aug 24–30, 2026 is one Monday-started week.
    expect(text).toMatch(/Week of Mon, Aug 24: swim 1× 25 min, 0\.5 mi; run 2× 70 min, 7\.0 mi \(total 95 min\)/)
    expect(text).toContain('- 2026-08-30 swim: Pool Swim — 0.5 mi, 25 min, avg HR 140')
    expect(text).toMatch(/: Half Marathon \[current goal\]$/m)
    expect(text).toMatch(/\(40 days away, about 6 weeks\)/)
    expect(text).toContain('- date TBD: Campeche 70.3')
  })

  it('marks past planned workouts done or missed', () => {
    const text = renderAceContext(
      context({
        trainingPlan: [
          { training_id: '1', date: '8/30/2026', morning_workout: 'Swim 2k', evening_workout: 'Run 5k', completed_morning: true, completed_evening: false },
          { training_id: '2', date: '8/31/2026', morning_workout: 'Bike 1h', completed_morning: false, completed_evening: false },
        ],
      }),
    )

    expect(text).toMatch(/Sun, Aug 30: AM: Swim 2k \(done\); PM: Run 5k \(missed\)/)
    expect(text).toMatch(/Mon, Aug 31 \(today\): AM: Bike 1h$/m)
  })

  it('keeps a pasted multi-line workout on its own day line', () => {
    const text = renderAceContext(
      context({
        trainingPlan: [
          {
            training_id: '2',
            date: '8/31/2026',
            morning_workout: '**Easy swim**\n• 100m breast\n• 4×50m free',
            completed_morning: false,
            completed_evening: false,
          },
        ],
      }),
    )

    expect(text).toMatch(/Mon, Aug 31 \(today\): AM: Easy swim: 100m breast; 4×50m free$/m)
  })

  it('summarises mood on its 1–5 scale and flags the journal as sensitive', () => {
    const text = renderAceContext(
      context({
        journal: [
          { journal_id: 'j2', entry_date: '2026-08-30', mood: 'Great', title: 'Long ride', body: 'Felt strong.', gratitude: [], prompt: '', reflection: '', tags: [] },
          { journal_id: 'j1', entry_date: '2026-08-29', mood: 'Tired', title: '', body: '', gratitude: [], prompt: '', reflection: '', tags: [] },
        ],
      }),
    )

    expect(text).toContain('Private and sensitive')
    expect(text).toContain('Average mood 3.5 on a 1 (Rough) to 5 (Great) scale over 2 entries.')
    expect(text).toContain('- 2026-08-30 "Long ride": Felt strong.')
  })
})

describe('sheetDateKey', () => {
  it('reads every date shape the sheets use', () => {
    expect(sheetDateKey('2026-10-06')).toBe('2026-10-06')
    expect(sheetDateKey('9/9/2026')).toBe('2026-09-09')
    expect(sheetDateKey('10/10/2026 6:30:00')).toBe('2026-10-10')
    expect(sheetDateKey('TBD')).toBe('')
    expect(sheetDateKey(undefined)).toBe('')
  })
})

describe('discipline', () => {
  it('collapses Garmin activity types into triathlon disciplines', () => {
    expect(discipline('lap_swimming')).toBe('swim')
    expect(discipline('indoor_cycling')).toBe('bike')
    expect(discipline('treadmill_running')).toBe('run')
    expect(discipline('strength_training')).toBe('strength')
    expect(discipline('breathwork')).toBe('other')
  })
})
