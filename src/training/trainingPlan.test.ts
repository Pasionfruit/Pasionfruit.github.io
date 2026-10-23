import { describe, expect, it } from 'vitest'
import { TRAINING_PLAN, mergeTrainingLog } from './trainingPlan'
import { toDateOnlyKey } from './workoutsOfDay'
import type { TrainingRecord } from '../data/sheets/types'

function on(date: string) {
  const row = TRAINING_PLAN.find((record) => record.date === date)
  if (!row) throw new Error(`no plan row for ${date}`)
  return row
}

describe('training plan', () => {
  it('covers every day from Week 1 Monday to Lavaman Sunday', () => {
    expect(TRAINING_PLAN).toHaveLength(27 * 7)
    expect(TRAINING_PLAN[0].date).toBe('2026-09-28')
    expect(TRAINING_PLAN[TRAINING_PLAN.length - 1].date).toBe('2027-04-04')
  })

  it('lifts in the morning and runs or swims in the afternoon through Week 4', () => {
    const monday = on('2026-09-28')
    expect(monday.morning_workout).toContain('Chest & Tri & Shoulders')
    expect(monday.evening_workout).toContain('Technique swim')
  })

  it('swaps to endurance in the morning and strength in the evening from Week 5', () => {
    const monday = on('2026-10-26')
    expect(monday.morning_workout).toContain('Technique swim')
    expect(monday.evening_workout).toContain('Chest & Tri & Shoulders')
  })

  it('puts the half marathon on Saturday November 28 and Lavaman on April 4', () => {
    expect(on('2026-11-28').morning_workout).toContain('HALF MARATHON')
    expect(on('2027-04-04').morning_workout).toContain('LAVAMAN')
  })

  it('marks rest days so the card reads them as rest', () => {
    // Saturday October 3, Week 1: no lifting, so the morning slot is a rest day.
    expect(on('2026-10-03').morning_workout).toBe('Rest day')
  })
})

describe('mergeTrainingLog', () => {
  it('lets a pasted row win over the plan for its date', () => {
    const pasted: TrainingRecord = {
      training_id: 'row-1',
      date: '2026-10-05',
      morning_workout: '**Pasted swim**\n• 1000m',
      evening_workout: '',
      completed_morning: false,
      completed_evening: false,
    }
    const merged = mergeTrainingLog([pasted])
    const forDay = merged.filter((row) => toDateOnlyKey(row.date) === '2026-10-05')

    expect(forDay).toEqual([pasted])
    expect(merged).toHaveLength(TRAINING_PLAN.length)
  })

  it('keeps logged rows outside the plan and fills plan days that have no row', () => {
    const outside: TrainingRecord = {
      training_id: 'row-2',
      date: '2025-01-01',
      morning_workout: 'Old',
      completed_morning: false,
      completed_evening: false,
    }
    const merged = mergeTrainingLog([outside])

    expect(merged).toContain(outside)
    expect(merged).toContainEqual(on('2026-09-28'))
  })
})
