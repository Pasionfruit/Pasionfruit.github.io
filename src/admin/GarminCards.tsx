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

const PERFORMANCE_METRICS: Metric[] = [
  { key: 'vo2_max', label: 'VO2 max', higherIsBetter: true },
  { key: 'training_readiness', label: 'Training readiness', higherIsBetter: true },
  { key: 'endurance_score', label: 'Endurance score', higherIsBetter: true },
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

export function GarminSleepCard({ title }: { title: string }) {
  const { rows, isLoading, error } = useGarminWellness()

  return (
    <GarminCard title={title} pill={rows.length > 0 ? latestDateLabel(rows) : undefined}>
      <MetricGrid rows={rows} metrics={SLEEP_METRICS} isLoading={isLoading} error={error} />
    </GarminCard>
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

export function GarminPerformanceCard({ title }: { title: string }) {
  const { rows, isLoading, error } = useGarminWellness()
  const status = rows.find((row) => row.training_status)?.training_status ?? ''

  return (
    <GarminCard title={title} pill={status || undefined}>
      <MetricGrid rows={rows} metrics={PERFORMANCE_METRICS} isLoading={isLoading} error={error} />
    </GarminCard>
  )
}
