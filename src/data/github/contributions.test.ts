import { afterEach, describe, expect, it, vi } from 'vitest'
import { getContributions, longestStreak } from './contributions'

afterEach(() => {
  vi.unstubAllGlobals()
})

function respond(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })))
}

describe('getContributions', () => {
  it('reads yearly totals and each day with its level', async () => {
    respond({
      total: { 2025: 185, 2026: 835 },
      contributions: [
        { date: '2026-01-05', count: 2, level: 1 },
        { date: '2026-01-06', count: 35, level: 4 },
      ],
    })

    const { totals, days } = await getContributions('Pasionfruit')

    expect(totals).toEqual({ 2025: 185, 2026: 835 })
    expect(days.get('2026-01-06')).toEqual({ date: '2026-01-06', count: 35, level: 4 })
    expect(fetch).toHaveBeenCalledWith('https://github-contributions-api.jogruber.de/v4/Pasionfruit', expect.anything())
  })

  it('treats an error or an unexpected shape as unavailable', async () => {
    respond({ error: 'nope' }, false)
    await expect(getContributions('Pasionfruit')).rejects.toThrow('GitHub activity is unavailable')

    respond({})
    await expect(getContributions('Pasionfruit')).rejects.toThrow('GitHub activity is unavailable')
  })
})

describe('longestStreak', () => {
  it('counts the longest run of consecutive active days within the year', () => {
    const days = new Map(
      ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2025-12-31'].map((date) => [date, { date, count: 1, level: 1 }]),
    )
    expect(longestStreak(days, 2026)).toBe(3)
    expect(longestStreak(days, 2025)).toBe(1)
    expect(longestStreak(new Map(), 2026)).toBe(0)
  })
})
