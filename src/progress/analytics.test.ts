import { describe, expect, it } from 'vitest'
import { parseMarks } from './detect'
import type { GarminHealthRecord } from '../data/sheets/types'
import type { Checkin } from './client'
import {
  PERIOD_END,
  acneTotal,
  consistency,
  correlations,
  formatPace,
  paceAtHeartRate,
  pearson,
  runPoints,
  weekStart,
  weeklyVolume,
  windows,
} from './analytics'

function checkin(date: string, extra: Partial<Checkin> = {}): Checkin {
  return {
    date, am_done: '', pm_done: '', towel: '', sheets: '', mask: '', acne_face: '', acne_back: '', redness: '', scar: '', products: '',
    sleep_h: '', energy: '', mood: '', stress: '', sugar_g: '', protein_g: '', carbs_g: '', dairy: '',
    min_training: '', min_content: '', min_leisure: '', notes: '', updated_at: '', ...extra,
  }
}

function run(date: string, miles: string, minutes: string, hr: string): GarminHealthRecord {
  return {
    date, activity_type: 'running', title: 'Run', distance_mi: miles, duration_min: minutes, avg_hr: hr,
    max_hr: '', calories: '', tss: '', activity_id: `${date}-${miles}`,
  } as GarminHealthRecord
}

describe('progress analytics', () => {
  it('ends the 90-day period on Feb 13, 2027', () => {
    expect(PERIOD_END).toBe('2027-02-13')
  })

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
    expect(weekStart('2026-11-22')).toBe('2026-11-16')
  })

  it('sums face and back acne, and treats both skipped as unknown', () => {
    expect(acneTotal(checkin('2026-11-16', { acne_face: '3', acne_back: '2' }))).toBe(5)
    expect(acneTotal(checkin('2026-11-16', { acne_face: '3' }))).toBe(3)
    expect(acneTotal(checkin('2026-11-16'))).toBeNull()
  })

  it('computes a correlation and refuses one with no variation', () => {
    expect(pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])).toBeCloseTo(1)
    expect(pearson([{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }])).toBeNull()
  })

  it('waits for enough days before reading a correlation, and never claims cause', () => {
    const few = correlations([checkin('2026-11-16', { sleep_h: '8', energy: '4' })])
    expect(few.find((c) => c.id === 'sleep-energy')?.reading).toMatch(/Not enough days/)

    const rows = Array.from({ length: 12 }, (_, i) =>
      checkin(`2026-11-${String(16 + i).padStart(2, '0')}`, { sleep_h: String(5 + (i % 4)), energy: String(1 + (i % 4)) }),
    )
    const reading = correlations(rows).find((c) => c.id === 'sleep-energy')?.reading ?? ''
    expect(reading).toMatch(/not proof of cause/)
  })

  it('pairs sugar with the next day\'s acne', () => {
    const rows = [
      checkin('2026-11-16', { sugar_g: '10' }),
      checkin('2026-11-17', { sugar_g: '50', acne_face: '2' }),
      checkin('2026-11-18', { acne_face: '9' }),
    ]
    expect(correlations(rows).find((c) => c.id === 'sugar-acne')?.n).toBe(2)
  })

  it('totals training volume by week', () => {
    const weeks = weeklyVolume([run('2026-11-16', '3', '30', '150'), run('2026-11-18', '2', '20', '150'), run('2026-11-24', '4', '40', '150')])
    expect(weeks).toEqual([
      { week: '2026-11-16', minutes: 50, miles: 5, sessions: 2 },
      { week: '2026-11-23', minutes: 40, miles: 4, sessions: 1 },
    ])
  })

  it('counts active days for consistency', () => {
    const result = consistency([run('2026-11-16', '3', '30', '150'), run('2026-11-16', '1', '10', '150'), run('2026-11-18', '3', '30', '150')], {
      from: '2026-11-16',
      to: '2026-11-19',
    })
    expect(result).toEqual({ activeDays: 2, days: 4, pct: 50 })
  })

  it('tracks pace only for runs inside a heart-rate band', () => {
    const points = runPoints([run('2026-11-16', '3', '30', '145'), run('2026-11-17', '3', '24', '175'), run('2026-11-18', '0.2', '3', '140')])
    expect(points).toHaveLength(2)
    expect(paceAtHeartRate(points, 140, 155)).toEqual([{ week: '2026-11-16', pace: 10, runs: 1 }])
    expect(formatPace(8.5)).toBe('8:30')
  })

  it('averages a field over 30, 60 and 90 days', () => {
    const rows = [checkin('2027-01-10', { sleep_h: '8' }), checkin('2026-11-25', { sleep_h: '6' })]
    const w = windows(rows, (c) => Number(c.sleep_h), '2027-01-15')
    expect(w.d30).toBe(8)
    expect(w.d60).toBe(7)
  })
})



describe('parseMarks', () => {
  it('turns pixel boxes into circles as a fraction of the width', () => {
    const marks = parseMarks({ spots: [{ kind: 'acne', bbox_2d: [100, 200, 120, 220] }] }, 1000, 1000)
    expect(marks).toHaveLength(1)
    expect(marks[0].x).toBeCloseTo(0.11)
    expect(marks[0].y).toBeCloseTo(0.21)
    expect(marks[0].r).toBeCloseTo(0.012) // floor so tiny spots stay tappable
  })

  it('drops malformed, oversized, off-image and overlapping spots', () => {
    const marks = parseMarks(
      {
        spots: [
          { kind: 'acne', bbox_2d: [100, 100, 130, 130] },
          { kind: 'acne', bbox_2d: [101, 101, 131, 131] }, // overlaps the first
          { kind: 'dragon', bbox_2d: [300, 300, 320, 320] },
          { kind: 'scar', bbox_2d: [0, 0, 900, 900] }, // a whole face is not a spot
          { kind: 'scar', bbox_2d: [2000, 100, 2020, 120] }, // off the image
          { kind: 'scar', bbox_2d: [1, 2, 3] },
          { kind: 'scar', bbox_2d: [500, 500, 530, 530] },
        ],
      },
      1000,
      1000,
    )
    expect(marks.map((m) => m.kind)).toEqual(['acne', 'scar'])
  })

  it('copes with no result at all', () => {
    expect(parseMarks(null, 100, 100)).toEqual([])
  })
})

import { importedDay, upkeep, withImported } from './analytics'

describe('imported sleep and training, and upkeep', () => {
  const wellness = [{ date: '2026-11-16', sleep_duration_h: '7.24' }] as never[]
  const activities = [run('2026-11-16', '3', '30', '150'), run('2026-11-16', '1', '15', '150')]

  it('reads sleep from Garmin and training minutes from every logged workout', () => {
    expect(importedDay('2026-11-16', wellness, activities)).toMatchObject({ sleep_h: '7.2', min_training: '45' })
    expect(importedDay('2026-11-17', wellness, activities)).toMatchObject({ sleep_h: '', min_training: '' })
  })

  it('fills saved days from the logs and adds days that only have imported data', () => {
    const rows = withImported([checkin('2026-11-16', { energy: '4', updated_at: 'x' })], wellness, [...activities, run('2026-11-18', '2', '20', '150')])
    expect(rows.map((r) => [r.date, r.sleep_h, r.min_training, r.energy])).toEqual([
      ['2026-11-16', '7.2', '45', '4'],
      ['2026-11-18', '', '20', ''],
    ])
  })

  it('takes food from Cronometer, preferring added sugar, and keeps manual values on days it sent nothing', () => {
    const nutrition = [{ date: '2026-11-16', calories: '2100', protein_g: '140.4', carbs_g: '210', sugar_g: '60', added_sugar_g: '25' }]
    expect(importedDay('2026-11-16', [], [], nutrition)).toMatchObject({ protein_g: '140', carbs_g: '210', sugar_g: '25' })
    expect(importedDay('2026-11-16', [], [], [{ ...nutrition[0], added_sugar_g: '' }]).sugar_g).toBe('60')

    const rows = withImported([checkin('2026-11-17', { protein_g: '90', updated_at: 'x' })], [], [], nutrition)
    expect(rows.map((r) => [r.date, r.protein_g])).toEqual([['2026-11-16', '140'], ['2026-11-17', '90']])
  })

  it('counts masks this week and days since the towel and sheets changed', () => {
    const logged = [
      checkin('2026-11-15', { mask: 'yes' }), // last week
      checkin('2026-11-17', { mask: 'yes', towel: 'yes' }),
      checkin('2026-11-19', { mask: 'yes', sheets: 'yes' }),
    ]
    expect(upkeep(logged, '2026-11-20')).toEqual({ masksThisWeek: 2, towelDaysAgo: 3, sheetsDaysAgo: 1 })
    expect(upkeep([], '2026-11-20')).toEqual({ masksThisWeek: 0, towelDaysAgo: null, sheetsDaysAgo: null })
  })
})

import { foodTotals, parseFood } from './food'

describe('meal estimates', () => {
  it('keeps plausible items, clamps wild numbers and totals the macros', () => {
    const items = parseFood({
      items: [
        { name: 'Chicken breast', grams: 150, protein_g: 46, carbs_g: 0, sugar_g: 0 },
        { name: 'Rice', grams: 200, protein_g: 5, carbs_g: 56, sugar_g: 0 },
        { name: '', grams: 100 },
        { name: 'Ghost', grams: 0 },
        { name: 'Mountain of rice', grams: 99999, protein_g: -4, carbs_g: 99999, sugar_g: 1 },
      ],
    })
    expect(items.map((i) => i.name)).toEqual(['Chicken breast', 'Rice', 'Mountain of rice'])
    expect(items[2]).toMatchObject({ grams: 2000, protein_g: 0, carbs_g: 400 })
    expect(foodTotals(items.slice(0, 2))).toEqual({ protein_g: 51, carbs_g: 56, sugar_g: 0 })
  })
})
