import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
  postSheetsAction: vi.fn(),
  fetchSheetTable: vi.fn(),
}))

vi.mock('./client', () => clientMocks)

import { getGarminWellness, hasWellnessMetrics } from './repositories'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getGarminWellness', () => {
  it('drops dated rows that carry no measurement at all', async () => {
    // The ingest script writes one row per day through today, so a day Garmin
    // has no data for still lands in the sheet as a date and nothing else.
    clientMocks.fetchSheetTable.mockResolvedValue([
      { date: '2026-09-02' },
      { date: '2026-09-01', steps: '' },
      { date: '2026-08-30', steps: '8000', sleep_score: '74' },
    ])

    const rows = await getGarminWellness()

    expect(rows.map((row) => row.date)).toEqual(['2026-08-30'])
    // Nothing may claim a newer date than the newest real reading.
    expect(rows[0].steps).toBe('8000')
  })

  it('returns rows newest first', async () => {
    clientMocks.fetchSheetTable.mockResolvedValue([
      { date: '2026-08-28', steps: '5000' },
      { date: '2026-08-30', steps: '8000' },
      { date: '2026-08-29', steps: '6000' },
    ])

    const rows = await getGarminWellness()
    expect(rows.map((row) => row.date)).toEqual(['2026-08-30', '2026-08-29', '2026-08-28'])
  })

  it('keeps a row whose only value is a non-numeric one', async () => {
    clientMocks.fetchSheetTable.mockResolvedValue([
      { date: '2026-08-30', training_status: 'productive' },
    ])

    const rows = await getGarminWellness()
    expect(rows).toHaveLength(1)
  })
})

describe('hasWellnessMetrics', () => {
  it('is false for a date with every metric blank or whitespace', () => {
    expect(hasWellnessMetrics({ date: '2026-09-02', steps: '', hrv: '   ' } as never)).toBe(false)
  })

  it('is true as soon as one metric has a value', () => {
    expect(hasWellnessMetrics({ date: '2026-09-02', steps: '10' } as never)).toBe(true)
  })
})
