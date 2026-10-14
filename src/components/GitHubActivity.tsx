import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getContributions, longestStreak, type Contributions } from '../data/github/contributions'
import { MonthTileHeatmap, type HeatmapDay } from './MonthTileHeatmap'

function formatDay(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * GitHub contributions as the same month-tile calendar the Training Log uses,
 * so code and training read side by side: a year at a time, darker for busier
 * days, with the year's total and longest streak above it.
 */
export function GitHubActivity({ username }: { username: string }) {
  const thisYear = new Date().getFullYear()
  const [data, setData] = useState<Contributions | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [year, setYear] = useState(thisYear)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const result = await getContributions(username, controller.signal)
        setData(result)
        setStatus('ready')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    })()
    return () => controller.abort()
  }, [username])

  // Years with any activity, plus this one, newest first.
  const years = useMemo(() => {
    const active = Object.entries(data?.totals ?? {})
      .filter(([, count]) => count > 0)
      .map(([value]) => Number(value))
    return Array.from(new Set([thisYear, ...active])).sort((a, b) => b - a)
  }, [data, thisYear])

  const total = data?.totals[year] ?? 0
  const streak = useMemo(() => (data ? longestStreak(data.days, year) : 0), [data, year])

  const dayInfo = useCallback(
    (key: string): HeatmapDay => {
      const count = data?.days.get(key)?.count ?? 0
      return {
        level: data?.days.get(key)?.level ?? 0,
        label: `${formatDay(key)} — ${count === 0 ? 'no contributions' : `${count} ${count === 1 ? 'contribution' : 'contributions'}`}`,
      }
    },
    [data],
  )

  const profileUrl = `https://github.com/${username}`

  return (
    <section className="github-activity" aria-labelledby="github-activity-title">
      <div className="github-activity-head">
        <h4 id="github-activity-title" className="github-activity-title">GitHub activity</h4>
        <a className="github-activity-link" href={profileUrl} target="_blank" rel="noreferrer">
          @{username}
          <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </div>

      {status === 'loading' ? (
        <p className="sheets-meta">Loading GitHub activity…</p>
      ) : status === 'error' ? (
        <p className="sheets-meta">
          GitHub activity is unavailable right now.{' '}
          <a href={profileUrl} target="_blank" rel="noreferrer">See it on GitHub</a>.
        </p>
      ) : (
        <>
          <p className="github-activity-summary">
            <strong>{total.toLocaleString('en-US')}</strong> {total === 1 ? 'contribution' : 'contributions'} in {year}
            {streak > 1 ? <> · longest streak <strong>{streak} days</strong></> : null}
          </p>

          <MonthTileHeatmap
            className="heatmap--github"
            year={year}
            years={years}
            onYearChange={setYear}
            dayInfo={dayInfo}
            label="GitHub contributions by month"
            tileNoun="GitHub contributions"
          />

          <p className="heatmap-legend heatmap--github" aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`training-log-tile level-${level}`} />
            ))}
            More
          </p>
        </>
      )}
    </section>
  )
}
