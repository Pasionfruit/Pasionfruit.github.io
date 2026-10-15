import { describe, expect, it } from 'vitest'
import { parseSnapshots } from './client'

describe('parseSnapshots', () => {
  it('reads each row, newest video first, and skips rows that do not parse', () => {
    const rows = [
      { snapshot: JSON.stringify({ video_id: 'old', published_at: '2026-10-01T00:00:00Z' }) },
      { snapshot: '{"video_id": "half' },
      { snapshot: JSON.stringify({ video_id: 'new', published_at: '2026-10-15T00:00:00Z' }) },
      { snapshot: JSON.stringify({ title: 'no id' }) },
      {},
    ]

    expect(parseSnapshots(rows).map((s) => s.video_id)).toEqual(['new', 'old'])
  })
})
