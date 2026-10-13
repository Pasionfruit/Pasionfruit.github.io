import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { getGarminWellness } from '../data/sheets/repositories'
import type { JournalEntryRecord } from '../data/sheets/types'
import { MOOD_COLORS, MOOD_SCALE, moodScore, type Mood } from './journal/moods'

// Register what this chart needs (idempotent alongside the app-wide registration).
Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip)

function localDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const WINDOW_DAYS = 30

/** Chart palette, kept apart from the UI accent: sleep is a data series. */
const SLEEP_COLOR = '#6366f1'

type Day = {
  key: string
  date: Date
  mood: string
  score: number | null
  sleepHours: number | null
}

/** Hours of sleep by day, from the Garmin wellness sheet. Empty if it cannot be read. */
function useSleepByDay() {
  const [sleep, setSleep] = useState<Map<string, number>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getGarminWellness()
        const byDay = new Map<string, number>()
        for (const row of rows) {
          const hours = Number.parseFloat(row.sleep_duration_h)
          if (Number.isFinite(hours) && hours > 0) byDay.set(row.date, hours)
        }
        if (!cancelled) setSleep(byDay)
      } catch {
        // Sleep is context for the moods, not the point; without it the chart shows mood alone.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return sleep
}

/**
 * The last 30 days as a line chart: mood on the left axis (Rough to Great, each
 * point in its mood's color) against hours of sleep on the right, so a rough
 * day can be read next to the night before it. Gaps are days with no entry.
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
  const sleepByDay = useSleepByDay()

  const { days, counts, average, logged, trend, sleepLogged, sleepAverage } = useMemo(() => {
    const byDate = new Map(entries.map((entry) => [entry.entry_date, entry]))
    const today = new Date()

    const days: Day[] = Array.from({ length: WINDOW_DAYS }, (_, offset) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (WINDOW_DAYS - 1 - offset))
      const key = localDayKey(date)
      const entry = byDate.get(key)
      return {
        key,
        date,
        mood: entry?.mood ?? '',
        score: entry ? moodScore(entry.mood) : null,
        sleepHours: sleepByDay.get(key) ?? null,
      }
    })

    const counts = {} as Record<Mood, number>
    for (const mood of MOOD_SCALE) {
      counts[mood] = 0
    }

    let total = 0
    let logged = 0
    let sleepTotal = 0
    let sleepLogged = 0
    for (const day of days) {
      if (day.sleepHours !== null) {
        sleepTotal += day.sleepHours
        sleepLogged += 1
      }
      if (day.score === null) {
        continue
      }
      counts[day.mood as Mood] += 1
      total += day.score
      logged += 1
    }

    // Trend: the newest half of the window against the half before it.
    const half = WINDOW_DAYS / 2
    const earlier = days.slice(0, half).filter((day) => day.score !== null)
    const recent = days.slice(half).filter((day) => day.score !== null)

    let trend: { direction: 'up' | 'down'; recentAvg: number; earlierAvg: number } | null = null
    if (earlier.length >= 3 && recent.length >= 3) {
      const mean = (list: Day[]) => list.reduce((sum, day) => sum + (day.score ?? 0), 0) / list.length
      const earlierAvg = mean(earlier)
      const recentAvg = mean(recent)
      // Half a mood step is a real shift; anything less is noise, so no note.
      if (Math.abs(recentAvg - earlierAvg) >= 0.5) {
        trend = { direction: recentAvg > earlierAvg ? 'up' : 'down', recentAvg, earlierAvg }
      }
    }

    return {
      days,
      counts,
      average: logged > 0 ? total / logged : 0,
      logged,
      trend,
      sleepLogged,
      sleepAverage: sleepLogged > 0 ? sleepTotal / sleepLogged : 0,
    }
  }, [entries, sleepByDay])

  const hasChart = logged > 0 || sleepLogged > 0

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
      ) : !hasChart ? (
        <p className="sheets-meta">No moods or sleep logged in the last {WINDOW_DAYS} days.</p>
      ) : (
        <>
          <div className="mood-series-key" aria-hidden="true">
            <span className="mood-series-item">
              <span className="mood-series-swatch mood-series-swatch--mood" />
              Mood
            </span>
            <span className="mood-series-item">
              <span className="mood-series-swatch" style={{ background: SLEEP_COLOR }} />
              Sleep{sleepLogged > 0 ? ` · avg ${sleepAverage.toFixed(1)} h` : ''}
            </span>
          </div>

          <MoodSleepChart days={days} />

          {/* The same numbers for screen readers, which cannot read the canvas. */}
          <table className="sr-only">
            <caption>Mood and hours of sleep, last {WINDOW_DAYS} days</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Mood</th>
                <th scope="col">Sleep</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((day) => day.score !== null || day.sleepHours !== null)
                .map((day) => (
                  <tr key={day.key}>
                    <td>{day.key}</td>
                    <td>{day.mood || 'no entry'}</td>
                    <td>{day.sleepHours === null ? 'no data' : `${day.sleepHours.toFixed(1)} h`}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {logged === 0 ? (
            <p className="sheets-meta">No moods logged in the last {WINDOW_DAYS} days yet, so this is sleep alone.</p>
          ) : (
            <div className="mood-legend">
              {MOOD_SCALE.map((mood) => (
                <span key={mood} className="mood-legend-item">
                  <span className="mood-swatch" style={{ background: MOOD_COLORS[mood] }} aria-hidden="true" />
                  {mood}
                  <small>{counts[mood]}</small>
                </span>
              ))}
            </div>
          )}

          {trend ? (
            <p className={`mood-trend-note mood-trend-note--${trend.direction}`}>
              {trend.direction === 'up' ? (
                <TrendingUp size={14} aria-hidden="true" />
              ) : (
                <TrendingDown size={14} aria-hidden="true" />
              )}
              <span>
                Mood is trending {trend.direction}: the last {WINDOW_DAYS / 2} days average{' '}
                {trend.recentAvg.toFixed(1)}, {trend.direction === 'up' ? 'up from' : 'down from'}{' '}
                {trend.earlierAvg.toFixed(1)} in the {WINDOW_DAYS / 2} before.
              </span>
            </p>
          ) : null}
        </>
      )}
    </article>
  )
}

function MoodSleepChart({ days }: { days: Day[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [themeVersion, setThemeVersion] = useState(0)

  // Rebuild with fresh CSS-variable colors when the site theme toggles.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    chartRef.current?.destroy()
    chartRef.current = null
    if (!canvasRef.current) return

    const style = getComputedStyle(document.documentElement)
    const gridColor = style.getPropertyValue('--border').trim() || 'rgba(127,127,127,0.15)'
    const tickColor = style.getPropertyValue('--text-muted').trim() || 'rgba(127,127,127,0.65)'
    const lineColor = style.getPropertyValue('--text-faint').trim() || '#a8a29e'
    const surface = style.getPropertyValue('--surface').trim() || '#ffffff'

    const labels = days.map((day) => day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    const moodColor = (index: number) => {
      const mood = days[index]?.mood as Mood | undefined
      return mood && MOOD_COLORS[mood] ? MOOD_COLORS[mood] : lineColor
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Mood',
            yAxisID: 'mood',
            data: days.map((day) => day.score),
            borderColor: lineColor,
            borderWidth: 2,
            // Monotone curves never overshoot a point, so the line stays between Rough and Great.
            cubicInterpolationMode: 'monotone',
            spanGaps: true,
            // Let a Great or Rough point draw whole instead of halved by the chart edge.
            clip: false,
            pointRadius: days.map((day) => (day.score === null ? 0 : 4.5)),
            pointHoverRadius: 6,
            pointBackgroundColor: days.map((_, index) => moodColor(index)),
            pointBorderColor: surface,
            pointBorderWidth: 1.5,
            order: 0,
          },
          {
            label: 'Sleep',
            yAxisID: 'sleep',
            data: days.map((day) => day.sleepHours),
            borderColor: SLEEP_COLOR,
            backgroundColor: `${SLEEP_COLOR}1f`,
            borderWidth: 2,
            fill: true,
            cubicInterpolationMode: 'monotone',
            spanGaps: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: SLEEP_COLOR,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        layout: { padding: { top: 8 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) =>
                items[0]
                  ? days[items[0].dataIndex].date.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '',
              label: (ctx) => {
                const day = days[ctx.dataIndex]
                if (ctx.dataset.label === 'Mood') return day.mood ? ` Mood: ${day.mood}` : ''
                return day.sleepHours === null ? '' : ` Sleep: ${day.sleepHours.toFixed(1)} h`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
            grid: { display: false },
            border: { color: gridColor },
          },
          mood: {
            position: 'left',
            min: 1,
            max: 5,
            ticks: {
              color: tickColor,
              font: { size: 10 },
              stepSize: 1,
              callback: (value) => MOOD_SCALE[Number(value) - 1] ?? '',
            },
            grid: { color: gridColor },
            border: { display: false },
          },
          sleep: {
            position: 'right',
            min: 0,
            suggestedMax: 10,
            ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 6, callback: (value) => `${value}h` },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [days, themeVersion])

  return (
    <div className="mood-chart">
      <canvas ref={canvasRef} role="img" aria-label={`Mood and hours of sleep over the last ${WINDOW_DAYS} days`} />
    </div>
  )
}
