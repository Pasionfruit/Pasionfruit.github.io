import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker from './worker.js'

const KEY = 'test-ingest-key-not-the-real-one'

/** A stand-in D1 that records the statements it is asked to run. */
function fakeDb() {
  const runs = []
  return {
    runs,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            run: async () => {
              runs.push({ sql, values })
              return { meta: {} }
            },
          }
        },
        all: async () => ({ results: [] }),
      }
    },
  }
}

function env(db = fakeDb()) {
  return { DB: db, MINITE_INGEST_KEY: KEY, ADMIN_EMAIL: 'pasionabe@gmail.com', SESSION_SECRET: 'x' }
}

function request(table, method, token, body) {
  return new Request(`https://db.example/db/${table}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const ROW = { video_id: 'ldVdVPo8eO8', title: 'A video', published_at: '2026-10-15', fetched_at: 'now', snapshot: '{}' }

describe('youtube_videos ingest key', () => {
  // Anything that is not the ingest key falls through to the admin check, which asks Google; Google says no.
  beforeEach(() => vi.stubGlobal('fetch', async () => new Response('{}', { status: 400 })))
  afterEach(() => vi.unstubAllGlobals())

  it('lets the desktop write a snapshot with the key', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('youtube_videos', 'POST', KEY, ROW), env(db))

    expect(response.status).toBe(200)
    expect(db.runs).toHaveLength(1)
    expect(db.runs[0].sql).toContain('INSERT OR REPLACE INTO youtube_videos')
    expect(db.runs[0].values[0]).toBe('ldVdVPo8eO8')
  })

  it('cannot read the table: reads need the admin', async () => {
    const response = await worker.fetch(request('youtube_videos', 'GET', KEY), env())
    expect(response.status).toBe(403)
  })

  it('cannot delete rows', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('youtube_videos', 'DELETE', KEY, { video_id: 'x' }), env(db))
    expect(response.status).toBe(403)
    expect(db.runs).toHaveLength(0)
  })

  it('cannot write any other table', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('journal_entries', 'POST', KEY, { journal_id: 'x' }), env(db))
    expect(response.status).toBe(403)
    expect(db.runs).toHaveLength(0)
  })

  it('rejects a wrong key, and a missing one', async () => {
    for (const token of [`${KEY}x`, 'nope', '']) {
      const db = fakeDb()
      const response = await worker.fetch(request('youtube_videos', 'POST', token, ROW), env(db))
      expect(response.status).toBe(403)
      expect(db.runs).toHaveLength(0)
    }
  })

  it('does nothing when the Worker has no key set', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('youtube_videos', 'POST', KEY, ROW), { ...env(db), MINITE_INGEST_KEY: '' })
    expect(response.status).toBe(403)
    expect(db.runs).toHaveLength(0)
  })
})

describe('ringconn_health ingest key', () => {
  beforeEach(() => vi.stubGlobal('fetch', async () => new Response('{}', { status: 400 })))
  afterEach(() => vi.unstubAllGlobals())

  const RING_KEY = 'ring-key-not-the-real-one'
  const DAY = { date: '2026-10-26', resting_hr: 52, hrv: 61, steps: 8400 }
  const ringEnv = (db = fakeDb()) => ({ ...env(db), RINGCONN_INGEST_KEY: RING_KEY })

  it('lets the phone upsert a day with its key', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('ringconn_health', 'POST', RING_KEY, DAY), ringEnv(db))

    expect(response.status).toBe(200)
    expect(db.runs[0].values.slice(0, 1)).toEqual(['2026-10-26'])
  })

  it('never lets an empty field blank a stored value', async () => {
    const db = fakeDb()
    await worker.fetch(request('ringconn_health', 'POST', RING_KEY, DAY), ringEnv(db))

    const { sql } = db.runs[0]
    expect(sql).toContain('ON CONFLICT(date) DO UPDATE SET')
    expect(sql).toContain("steps = CASE WHEN excluded.steps <> '' THEN excluded.steps ELSE ringconn_health.steps END")
    expect(sql).not.toContain('INSERT OR REPLACE')
  })

  it('does not accept the YouTube key, or write other tables', async () => {
    const db = fakeDb()
    expect((await worker.fetch(request('ringconn_health', 'POST', KEY, DAY), ringEnv(db))).status).toBe(403)
    expect((await worker.fetch(request('youtube_videos', 'POST', RING_KEY, ROW), ringEnv(db))).status).toBe(403)
    expect(db.runs).toHaveLength(0)
  })

  it('reads publicly', async () => {
    const response = await worker.fetch(request('ringconn_health', 'GET'), ringEnv())
    expect(response.status).toBe(200)
  })
})

describe('apple_workouts ingest key', () => {
  beforeEach(() => vi.stubGlobal('fetch', async () => new Response('{}', { status: 400 })))
  afterEach(() => vi.unstubAllGlobals())

  const WORKOUT_KEY = 'workout-key-not-the-real-one'
  const WORKOUT = { workout_id: '2026-11-13T07:30', date: '2026-11-13', type: 'Traditional Strength Training', duration_min: 52 }
  const workoutEnv = (db = fakeDb()) => ({
    ...env(db),
    RINGCONN_INGEST_KEY: 'ring-key-not-the-real-one',
    WORKOUT_INGEST_KEY: WORKOUT_KEY,
  })

  it('lets the phone upsert a workout with its key', async () => {
    const db = fakeDb()
    const response = await worker.fetch(request('apple_workouts', 'POST', WORKOUT_KEY, WORKOUT), workoutEnv(db))

    expect(response.status).toBe(200)
    expect(db.runs[0].sql).toContain('INSERT OR REPLACE INTO apple_workouts')
    expect(db.runs[0].values[0]).toBe('2026-11-13T07:30')
  })

  it('keeps the RingConn key and the workout key to their own tables', async () => {
    const db = fakeDb()
    expect((await worker.fetch(request('apple_workouts', 'POST', 'ring-key-not-the-real-one', WORKOUT), workoutEnv(db))).status).toBe(403)
    expect((await worker.fetch(request('ringconn_health', 'POST', WORKOUT_KEY, { date: '2026-11-13' }), workoutEnv(db))).status).toBe(403)
    expect(db.runs).toHaveLength(0)
  })

  it('cannot delete, and reads publicly', async () => {
    const db = fakeDb()
    expect((await worker.fetch(request('apple_workouts', 'DELETE', WORKOUT_KEY, { workout_id: 'x' }), workoutEnv(db))).status).toBe(403)
    expect(db.runs).toHaveLength(0)
    expect((await worker.fetch(request('apple_workouts', 'GET'), workoutEnv())).status).toBe(200)
  })
})
