import { describe, expect, it } from 'vitest'
import type { GarminPrRecord } from '../../data/sheets/types'
import { buildPrBoard, formatClock } from './prs'

function pr(type_id: number, value: number, date = '2026-06-06', extra: Partial<GarminPrRecord> = {}): GarminPrRecord {
  return {
    type_id: String(type_id),
    value: String(value),
    activity_type: 'running',
    activity_id: '1',
    activity_name: '',
    date,
    pool_unit: '',
    ...extra,
  }
}

// Values copied from a real account's records.
const RECORDS = [
  pr(1, 351.14),
  pr(2, 598.167),
  pr(3, 1957.699),
  pr(4, 3846.879, '2026-10-03'),
  pr(7, 11072.29, '2026-07-27'),
  pr(8, 12584.69, '2026-07-22'),
  pr(9, 126, '2026-07-22'),
  pr(12, 23400, '2026-09-11'),
  pr(15, 4, '2026-07-28'),
  pr(16, 1, '2026-10-13'),
  pr(17, 1025, '2026-10-12', { pool_unit: 'meter' }),
  pr(18, 57.999, '2026-10-12', { pool_unit: 'meter' }),
]

const TODAY = new Date(2026, 9, 13)

describe('formatClock', () => {
  it('rounds to the second and drops empty hours', () => {
    expect(formatClock(1957.699)).toBe('32:38')
    expect(formatClock(3846.879)).toBe('1:04:07')
    expect(formatClock(57.999)).toBe('0:58')
  })
})

describe('buildPrBoard', () => {
  const board = buildPrBoard(RECORDS, TODAY)
  const tile = (label: string) => [...board.race, ...board.distance, ...board.more].find((t) => t.label === label)!

  it('times race distances with pace, and names the next round number to beat', () => {
    expect(tile('5K')).toMatchObject({ value: '32:38', detail: '10:30 /mi', goal: 'Sub-32:00 · 38 s to cut' })
    expect(tile('10K')).toMatchObject({ value: '1:04:07', goal: 'Sub-1:04:00 · 7 s to cut' })
    expect(tile('1K')).toMatchObject({ value: '5:51', goal: 'Sub-5:50 · 1 s to cut' })
  })

  it('lists every race distance, and shows how far the longest run gets toward unset ones', () => {
    expect(board.race.map((t) => t.label)).toEqual(['1K', 'Mile', '5K', '10K', 'Half marathon', 'Marathon'])
    const half = tile('Half marathon')
    expect(half.value).toBe('')
    expect(half.goal).toBe('Longest run 6.9 of 13.1 mi')
    expect(half.progress).toBeCloseTo(6.88 / 13.11, 2)
  })

  it('reports distances in miles, swims in the pool unit, climbs in feet', () => {
    expect(tile('Longest run')).toMatchObject({ value: '6.88 mi', goal: '7 mi next · 0.12 mi to go' })
    expect(tile('Longest ride')).toMatchObject({ value: '7.82 mi' })
    expect(tile('Longest swim')).toMatchObject({ value: '1,025 m', goal: '1,250 m next · 225 m to go' })
    expect(tile('Fastest 100\u00a0m')).toMatchObject({ value: '0:58' })
    expect(tile('Biggest ride climb')).toMatchObject({ value: '413 ft' })
    expect(tile('Most steps in a day')).toMatchObject({ value: '23,400', goal: '25,000 next · 1,600 to go' })
    expect(tile('Longest step-goal streak')).toMatchObject({ value: '4 days' })
  })

  it('marks records set in the last 30 days as new', () => {
    expect(tile('10K').isNew).toBe(true)
    expect(tile('5K').isNew).toBe(false)
  })

  it('skips record types it does not know rather than guessing', () => {
    const labels = [...board.race, ...board.distance, ...board.more].map((t) => t.typeId)
    expect(labels).not.toContain(16)
  })
})
