import { useMemo } from 'react'
import type { JournalEntryRecord } from '../data/sheets/types'
import { MOOD_COLORS, MOOD_SCALE, moodScore, type Mood } from './journal/moods'

function localDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const WINDOW_DAYS = 30

/**
 * The last 30 days as a strip of one cell per day, plus how the moods break
 * down. Gaps are days with no entry, which are as informative as the scores.
 */
export function MoodTrackerCard({
  title,
  entries,
  isLoading,
}: {
  title: string
  entries: JournalEntryRecord[]
  isLoading: boolean
}) {
  const { days, counts, average, logged } = useMemo(() => {
    const byDate = new Map(entries.map((entry) => [entry.entry_date, entry]))
    const today = new Date()

    const days = Array.from({ length: WINDOW_DAYS }, (_, offset) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (WINDOW_DAYS - 1 - offset))
      const key = localDayKey(date)
      const entry = byDate.get(key)
      return { key, date, mood: entry?.mood ?? '', score: entry ? moodScore(entry.mood) : null }
    })

    const counts = {} as Record<Mood, number>
    for (const mood of MOOD_SCALE) {
      counts[mood] = 0
    }

    let total = 0
    let logged = 0
    for (const day of days) {
      if (day.score === null) {
        continue
      }
      counts[day.mood as Mood] += 1
      total += day.score
      logged += 1
    }

    return { days, counts, average: logged > 0 ? total / logged : 0, logged }
  }, [entries])

  return (
    <article className="info-card admin-card mood-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        {!isLoading && logged > 0 ? (
          <span className="admin-pill">
            {logged}/{WINDOW_DAYS} days · avg {average.toFixed(1)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="sheets-meta">Loading moods…</p>
      ) : logged === 0 ? (
        <p className="sheets-meta">No moods logged in the last {WINDOW_DAYS} days.</p>
      ) : (
        <>
          <ol className="mood-strip" aria-label={`Mood for the last ${WINDOW_DAYS} days`}>
            {days.map((day) => (
              <li
                key={day.key}
                className={`mood-cell ${day.score === null ? 'empty' : ''}`}
                style={
                  day.score === null
                    ? undefined
                    : {
                        background: MOOD_COLORS[day.mood as Mood],
                        // Rougher days read shorter as well as redder.
                        height: `${30 + day.score * 12}%`,
                      }
                }
                title={`${day.key}${day.mood ? ` — ${day.mood}` : ' — no entry'}`}
              >
                <span className="sr-only">
                  {day.key}: {day.mood || 'no entry'}
                </span>
              </li>
            ))}
          </ol>

          <div className="mood-legend">
            {MOOD_SCALE.map((mood) => (
              <span key={mood} className="mood-legend-item">
                <span className="mood-swatch" style={{ background: MOOD_COLORS[mood] }} aria-hidden="true" />
                {mood}
                <small>{counts[mood]}</small>
              </span>
            ))}
          </div>
        </>
      )}
    </article>
  )
}
