import { describe, expect, it } from 'vitest'
import type { GarminHealthRecord } from '../../data/sheets/types'
import { VIEW_COLUMNS, activitiesFor, activityLabel, sportOf, viewSummary } from './activities'

function activity(date: string, activity_type: string, distance_mi: string, duration_min: string): GarminHealthRecord {
  return {
    date,
    activity_type,
    title: activity_type,
    distance_mi,
    duration_min,
    avg_hr: '140',
    max_hr: '170',
    calories: '300',
    tss: '',
    activity_id: `${date}-${activity_type}`,
  }
}

const TODAY = new Date(2026, 9, 13)

const ROWS = [
  activity('2026-10-12', 'lap_swimming', '0.64', '28.9'),
  activity('2026-10-11', 'indoor_cycling', '', '70.1'),
  activity('2026-10-10', 'treadmill_running', '6.55', '71.8'),
  activity('2026-10-10', 'strength_training', '', '40.3'),
  activity('2026-10-06', 'running', '3.10', '30.0'),
  activity('2026-10-02', 'cycling', '7.82', '30.0'),
  activity('2026-08-01', 'running', '9.00', '90.0'), // outside the 30-day window
]

describe('sportOf', () => {
  it('sorts Garmin activity types into runs, swims and bikes', () => {
    expect(sportOf('treadmill_running')).toBe('run')
    expect(sportOf('trail_running')).toBe('run')
    expect(sportOf('lap_swimming')).toBe('swim')
    expect(sportOf('open_water_swimming')).toBe('swim')
    expect(sportOf('indoor_cycling')).toBe('bike')
    expect(sportOf('virtual_ride')).toBe('bike')
    expect(sportOf('strength_training')).toBe('other')
  })
})

describe('activitiesFor', () => {
  it('keeps every activity under Workouts and only the sport under the others', () => {
    expect(activitiesFor('workouts', ROWS)).toHaveLength(ROWS.length)
    expect(activitiesFor('runs', ROWS).map((row) => row.activity_type)).toEqual(['treadmill_running', 'running', 'running'])
    expect(activitiesFor('swims', ROWS)).toHaveLength(1)
    expect(activitiesFor('bikes', ROWS)).toHaveLength(2)
  })
})

describe('viewSummary', () => {
  it('counts the last 30 days of runs, with miles, pace and the longest one', () => {
    const { tiles, note } = viewSummary('runs', ROWS, TODAY)
    expect(tiles).toEqual([
      { label: 'Runs / 30d', value: '2' },
      { label: 'Miles', value: '9.7' },
      { label: 'Avg pace', value: '10:33 /mi' },
    ])
    expect(note).toBe('Longest run: 6.5 mi on Oct 10.')
  })

  it('reports swims in meters with pace per 100 m', () => {
    const { tiles } = viewSummary('swims', ROWS, TODAY)
    expect(tiles[1]).toEqual({ label: 'Meters', value: '1,030' })
    expect(tiles[2].value).toBe('2:48 /100m')
  })

  it('reports rides by speed, counting only rides with a distance', () => {
    // The indoor ride has time but no distance, so it stays out of the average.
    expect(viewSummary('bikes', ROWS, TODAY).tiles[2]).toEqual({ label: 'Avg speed', value: '15.6 mph' })
    expect(viewSummary('swims', [], TODAY).note).toBe('No swims in the last 30 days.')
  })

  it('summarises every workout by sessions, hours and active days', () => {
    expect(viewSummary('workouts', ROWS, TODAY).tiles).toEqual([
      { label: 'Workouts / 30d', value: '6' },
      { label: 'Hours', value: '4.5' },
      { label: 'Active days', value: '5' },
    ])
  })
})

describe('columns', () => {
  it('labels activity types in sentence case and gives each sport its own measure', () => {
    expect(activityLabel('treadmill_running')).toBe('Treadmill running')
    const runPace = VIEW_COLUMNS.runs.find((column) => column.label === 'Pace')!
    expect(runPace.value(ROWS[2])).toBe('10:58 /mi')
    const swimDistance = VIEW_COLUMNS.swims.find((column) => column.label === 'Distance')!
    expect(swimDistance.value(ROWS[0])).toBe('1,030 m')
  })
})
