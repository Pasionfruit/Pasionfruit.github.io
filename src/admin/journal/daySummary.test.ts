import { describe, expect, it } from 'vitest'
import type { Chore } from '../../data/chores/client'
import type { GarminHealthRecord, TrainingRecord } from '../../data/sheets/types'
import type { TodoistTask } from '../../data/todoist/types'
import { buildDaySummary, MAX_BULLETS, type DaySources } from './daySummary'

const DAY = '2026-11-05'

const empty: DaySources = { training: [], activities: [], chores: [], tasks: [] }

const training = (over: Partial<TrainingRecord>): TrainingRecord => ({
  training_id: 't', date: DAY, completed_morning: false, completed_evening: false, ...over,
})

const run: GarminHealthRecord = {
  date: DAY, activity_type: 'running', title: 'Morning run', distance_mi: '3.12', duration_min: '28.4',
  avg_hr: '', max_hr: '', calories: '', tss: '', activity_id: '1',
}

const chore = (name: string, category: Chore['category'], lastDone = DAY): Chore => ({
  id: name, name, category, intervalDays: 1, lastDone,
})

const task = (content: string): TodoistTask => ({ id: content, content, priority: 1, is_completed: true })

describe('buildDaySummary', () => {
  it('says nothing for a day with nothing logged', () => {
    expect(buildDaySummary(DAY, empty)).toEqual([])
  })

  it('summarises workouts from the plan and from Garmin', () => {
    const bullets = buildDaySummary(DAY, {
      ...empty,
      training: [training({ morning_workout: 'Upper body', completed_morning: true, evening_workout: 'Yoga' })],
      activities: [run],
    })
    expect(bullets).toEqual(['- Workout: completed Upper body; Garmin logged Running 3.1 mi 28 min.'])
  })

  it('ignores planned workouts that were not completed, and other days', () => {
    const bullets = buildDaySummary(DAY, {
      ...empty,
      training: [training({ morning_workout: 'Upper body' }), training({ date: '2026-11-04', morning_workout: 'Legs', completed_morning: true })],
      activities: [{ ...run, date: '2026-11-04' }],
    })
    expect(bullets).toEqual([])
  })

  it('counts chores done that day by category, busiest first', () => {
    const bullets = buildDaySummary(DAY, {
      ...empty,
      chores: [
        chore('Dishes', 'kitchen'), chore('Counters', 'kitchen'), chore('Stove', 'kitchen'),
        chore('Litter', 'cats'), chore('Wet food', 'cats'),
        chore('Vacuum', 'hygiene', '2026-11-04'),
      ],
    })
    expect(bullets).toEqual(['- Chores: 5 done (kitchen 3, cats 2).'])
  })

  it('lists a few finished tasks and folds the rest', () => {
    const bullets = buildDaySummary(DAY, {
      ...empty,
      tasks: ['Pay rent', 'Call dentist', 'Renew passport', 'Buy bulbs', 'Email Sam'].map(task),
    })
    expect(bullets).toEqual(['- Tasks: finished 5 — Pay rent, Call dentist, Renew passport +2 more.'])
  })

  it('gives at most three bullets, workout then chores then tasks', () => {
    const bullets = buildDaySummary(DAY, {
      training: [training({ evening_workout: 'Run', completed_evening: true })],
      activities: [],
      chores: [chore('Dishes', 'kitchen')],
      tasks: [task('Pay rent')],
    })
    expect(bullets).toHaveLength(MAX_BULLETS)
    expect(bullets.map((b) => b.split(':')[0])).toEqual(['- Workout', '- Chores', '- Tasks'])
  })
})
