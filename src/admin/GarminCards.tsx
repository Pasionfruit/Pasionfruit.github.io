import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getGarminWellness } from '../data/sheets/repositories'
import type { GarminWellnessRecord } from '../data/sheets/types'

/** One metric to surface, and where to read it from a wellness row. */
type Metric = {
  key: keyof GarminWellnessRecord
  label: string
  unit?: string
  /** Higher is better — drives the trend arrow's colour. */
  higherIsBetter?: boolean
}

const SLEEP_METRICS: Metric[] = [
  { key: 'sleep_score', label: 'Sleep score', higherIsBetter: true },
  { key: 'sleep_duration_h', label: 'Time asleep', unit: 'h', higherIsBetter: true },
  { key: 'deep_sleep_h', label: 'Deep', unit: 'h', higherIsBetter: true },
  { key: 'rem_sleep_h', label: 'REM', unit: 'h', higherIsBetter: true },
  { key: 'hrv', label: 'HRV', unit: 'ms', higherIsBetter: true },
  { key: 'resting_hr', label: 'Resting HR', unit: 'bpm', higherIsBetter: false },
  { key: 'body_battery_high', label: 'Body battery peak', higherIsBetter: true },
  { key: 'respiration_avg', label: 'Respiration', unit: 'br/min', higherIsBetter: false },
]

const WELLNESS_METRICS: Metric[] = [
  { key: 'steps', label: 'Steps', higherIsBetter: true },
  { key: 'intensity_minutes', label: 'Intensity minutes', higherIsBetter: true },
  { key: 'calories', label: 'Calories', higherIsBetter: true },
  { key: 'stress_avg', label: 'Avg stress', higherIsBetter: false },
  { key: 'spo2_avg', label: 'SpO2', unit: '%', higherIsBetter: true },
  { key: 'body_battery_low', label: 'Body battery low', higherIsBetter: true },
]

function toNumber(value: string): number | null {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Latest non-empty value for a metric, plus how it compares with the average of
 * the prior fortnight. A single day is noise, so the comparison is against a
 * window rather than yesterday.
 */
function summarise(rows: GarminWellnessRecord[], metric: Metric) {
  const values = rows
    .map((row) => ({ date: row.date, value: toNumber(String(row[metric.key])) }))
    .filter((entry): entry is { date: string; value: number } => entry.value !== null)

  if (values.length === 0) {
    return null
  }

  const latest = values[0]
  const baseline = values.slice(1, 15)
  const average =
    baseline.length > 0 ? baseline.reduce((sum, entry) => sum + entry.value, 0) / baseline.length : null

  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (average !== null && average !== 0) {
    const delta = (latest.value - average) / Math.abs(average)
    if (delta > 0.03) trend = 'up'
    else if (delta < -0.03) trend = 'down'
  }

  const good =
    trend === 'flat' ? null : (trend === 'up') === (metric.higherIsBetter ?? true)

  return { latest, average, trend, good }
}

function formatValue(value: number) {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  return value.toFixed(1)
}

function useGarminWellness() {
  const [rows, setRows] = useState<GarminWellnessRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await getGarminWellness()
        if (!cancelled) {
          setRows(data)
          setError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setRows([])
          setError(caught instanceof Error ? caught.message : 'Unable to load Garmin wellness data')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { rows, isLoading, error }
}

function MetricGrid({
  rows,
  metrics,
  isLoading,
  error,
}: {
  rows: GarminWellnessRecord[]
  metrics: Metric[]
  isLoading: boolean
  error: string
}) {
  const summaries = useMemo(
    () => metrics.map((metric) => ({ metric, summary: summarise(rows, metric) })),
    [rows, metrics],
  )

  const hasAny = summaries.some((entry) => entry.summary !== null)

  if (isLoading) {
    return <p className="sheets-meta">Loading Garmin data…</p>
  }

  if (error) {
    return <p className="sheets-meta">{error}</p>
  }

  if (!hasAny) {
    return (
      <p className="sheets-meta">
        No Garmin wellness data yet. Run{' '}
        <code>python scripts/health-ingestion/ingest_garmin_wellness.py --days 30</code> after
        creating the <code>garmin_wellness</code> sheet.
      </p>
    )
  }

  return (
    <div className="garmin-metric-grid">
      {summaries.map(({ metric, summary }) => (
        <div key={String(metric.key)} className="garmin-metric">
          <span className="garmin-metric-label">{metric.label}</span>
          <span className="garmin-metric-value">
            {summary ? formatValue(summary.latest.value) : '—'}
            {summary && metric.unit ? <small>{metric.unit}</small> : null}
          </span>
          {summary && summary.trend !== 'flat' ? (
            <span className={`garmin-metric-trend ${summary.good ? 'good' : 'bad'}`}>
              {summary.trend === 'up' ? '▲' : '▼'}
              {summary.average !== null ? ` vs ${formatValue(summary.average)} avg` : ''}
            </span>
          ) : (
            <span className="garmin-metric-trend">
              {summary?.average !== null && summary ? `≈ ${formatValue(summary.average)} avg` : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function latestDateLabel(rows: GarminWellnessRecord[]) {
  const date = rows[0]?.date
  if (!date) {
    return ''
  }

  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) {
    return date
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Shared shell matching the collapse behaviour of the other Health cards
 * (`.section-collapse-btn` with ▾/▸), so every section on the page folds away.
 */
function GarminCard({
  title,
  pill,
  defaultCollapsed = false,
  children,
}: {
  title: string
  pill?: string
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {pill ? <span className="admin-pill">{pill}</span> : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {isCollapsed ? null : children}
    </article>
  )
}

/** ISO week start (Monday) for a date key. */
function weekStartKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

function formatDayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Collapse rows into one averaged row per ISO week, so the same MetricGrid can
 * render a week without knowing anything about averaging.
 */
function toWeeklyAverages(rows: GarminWellnessRecord[]): GarminWellnessRecord[] {
  const byWeek = new Map<string, GarminWellnessRecord[]>()

  for (const row of rows) {
    if (!row.date) continue
    const key = weekStartKey(row.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), row])
  }

  const numericKeys = (Object.keys(rows[0] ?? {}) as (keyof GarminWellnessRecord)[]).filter(
    (key) => key !== 'date' && key !== 'training_status',
  )

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekKey, weekRows]) => {
      const averaged = { date: weekKey, training_status: '' } as GarminWellnessRecord

      for (const key of numericKeys) {
        const values = weekRows
          .map((row) => toNumber(String(row[key])))
          .filter((value): value is number => value !== null)

        averaged[key] = values.length
          ? String(values.reduce((sum, value) => sum + value, 0) / values.length)
          : ''
      }

      return averaged
    })
}

/**
 * Sleep & recovery. Deliberately not collapsible — it is the reason the
 * Personal page loads, so it is always open.
 */
export function GarminSleepCard({ title }: { title: string }) {
  const { rows, isLoading, error } = useGarminWellness()
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState('')

  const weekly = useMemo(() => toWeeklyAverages(rows), [rows])
  const source = mode === 'week' ? weekly : rows

  // Default to the newest row once data arrives, but let a chosen date stick.
  const activeDate = selectedDate || source[0]?.date || ''

  const visible = useMemo(() => {
    if (!activeDate) return source
    const index = source.findIndex((row) => row.date === activeDate)
    return index < 0 ? source : source.slice(index)
  }, [source, activeDate])

  const bounds = useMemo(() => {
    const dates = rows.map((row) => row.date).filter(Boolean).sort()
    return { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' }
  }, [rows])

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          <div className="garmin-mode-toggle" role="group" aria-label="Averaging period">
            <button
              type="button"
              className={mode === 'day' ? 'active' : ''}
              onClick={() => { setMode('day'); setSelectedDate('') }}
            >
              Day
            </button>
            <button
              type="button"
              className={mode === 'week' ? 'active' : ''}
              onClick={() => { setMode('week'); setSelectedDate('') }}
            >
              Week avg
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="garmin-date-row">
          <label>
            <span>{mode === 'week' ? 'Week of' : 'Date'}</span>
            <input
              type="date"
              value={activeDate}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => setSelectedDate(
                mode === 'week' && event.target.value
                  ? weekStartKey(event.target.value)
                  : event.target.value,
              )}
            />
          </label>
          <span className="sheets-meta">
            {activeDate
              ? mode === 'week'
                ? `Week beginning ${formatDayLabel(activeDate)}`
                : formatDayLabel(activeDate)
              : ''}
          </span>
          {selectedDate ? (
            <button type="button" className="secondary-action" onClick={() => setSelectedDate('')}>
              Latest
            </button>
          ) : null}
        </div>
      ) : null}

      <MetricGrid rows={visible} metrics={SLEEP_METRICS} isLoading={isLoading} error={error} />
    </article>
  )
}

export function GarminWellnessCard({ title }: { title: string }) {
  const { rows, isLoading, error } = useGarminWellness()

  return (
    <GarminCard title={title} pill={rows.length > 0 ? latestDateLabel(rows) : undefined}>
      <MetricGrid rows={rows} metrics={WELLNESS_METRICS} isLoading={isLoading} error={error} />
    </GarminCard>
  )
}
