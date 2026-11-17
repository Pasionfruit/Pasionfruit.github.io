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
  it('turns fractional spots into circles in width units', () => {
    const marks = parseMarks({ spots: [{ kind: 'acne', x: 0.25, y: 0.5 }] }, 1000, 2000)
    expect(marks).toEqual([{ kind: 'acne', x: 0.25, y: 1, r: 0.018 }])
  })

  it('drops malformed, off-image and overlapping spots', () => {
    const marks = parseMarks(
      {
        spots: [
          { kind: 'acne', x: 0.3, y: 0.3 },
          { kind: 'acne', x: 0.301, y: 0.301 }, // on top of the first
          { kind: 'dragon', x: 0.5, y: 0.5 },
          { kind: 'scar', x: 1.5, y: 0.5 }, // off the image
          { kind: 'scar', x: 'a', y: 0.5 },
          { kind: 'scar', x: 0.7, y: 0.7 },
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

import { faceAcneFor } from './analytics'
import type { SkinPhoto } from './client'

describe('face acne from three shots', () => {
  const photo = (id: string, angle: string, taken: string, acne: number, verified = 'yes'): SkinPhoto => ({
    photo_id: id, taken_at: taken, angle, notes: '', verified, created_at: '',
    marks: JSON.stringify(Array.from({ length: acne }, (_, i) => ({ kind: 'acne', x: i / 10, y: 0.1, r: 0.02 }))),
  })

  it('sums the verified front, left and right shots for the day and ignores the back and other days', () => {
    const photos = [
      photo('a', 'front', '2026-11-16', 3),
      photo('b', 'left', '2026-11-16', 2),
      photo('c', 'back', '2026-11-16', 9),
      photo('d', 'front', '2026-11-15', 7),
      photo('e', 'right', '2026-11-16', 4, ''),
      photo('f', 'face', '2026-11-16', 1), // taken before the face was split into three shots
    ]
    expect(faceAcneFor('2026-11-16', photos)).toBe(6)
  })

  it('uses the photo being confirmed instead of its saved marks', () => {
    expect(faceAcneFor('2026-11-16', [photo('a', 'front', '2026-11-16', 3), photo('b', 'left', '2026-11-16', 2)], { photoId: 'a', acne: 5 })).toBe(7)
  })
})
