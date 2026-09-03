import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getGarminWellness } from '../data/sheets/repositories'
import { todayKey } from '../data/todoist/dates'
import type { GarminWellnessRecord } from '../data/sheets/types'
import {
  daysBetween,
  formatDayLabel,
  formatValue,
  resolveDate,
  summarise,
  toWeeklyAverages,
  weekStartKey,
  type Metric,
} from './garmin/wellness'

const SLEEP_METRICS: Metric[] = [
  {
    key: 'sleep_score',
    label: 'Sleep score',
    higherIsBetter: true,
    description:
      "Garmin's 0–100 rating of last night, combining how long you slept, the balance of deep and REM, and how restless you were.",
  },
  {
    key: 'sleep_duration_h',
    label: 'Time asleep',
    unit: 'h',
    higherIsBetter: true,
    description: 'Hours actually asleep — time awake in bed is excluded.',
  },
  {
    key: 'deep_sleep_h',
    label: 'Deep',
    unit: 'h',
    higherIsBetter: true,
    description:
      'Deep sleep, the stage that does most of the physical repair. Usually 1–2h, and the first thing alcohol or a late meal cuts into.',
  },
  {
    key: 'rem_sleep_h',
    label: 'REM',
    unit: 'h',
    higherIsBetter: true,
    description:
      'Dreaming sleep, tied to memory and mood. Usually 1.5–2h, and it comes mostly in the second half of the night.',
  },
  {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    higherIsBetter: true,
    description:
      'Overnight average variation between heartbeats. Higher generally means better recovered — but the useful signal is your own trend, not the absolute number.',
  },
  {
    key: 'resting_hr',
    label: 'Resting HR',
    unit: 'bpm',
    higherIsBetter: false,
    description:
      'Lowest sustained heart rate overnight. A jump of several bpm often shows up a day before you feel run down.',
  },
  {
    key: 'respiration_avg',
    label: 'Respiration',
    unit: 'br/min',
    higherIsBetter: false,
    description: 'Average breaths per minute while asleep. Typically 12–16 for adults.',
  },
]

const WELLNESS_METRICS: Metric[] = [
  {
    key: 'steps',
    label: 'Steps',
    higherIsBetter: true,
    description: 'Total steps recorded across the day.',
  },
  {
    key: 'intensity_minutes',
    label: 'Intensity minutes',
    higherIsBetter: true,
    description:
      'Minutes of moderate activity, with vigorous minutes counted double. WHO guidance is 150 a week.',
  },
  {
    key: 'calories',
    label: 'Calories',
    higherIsBetter: true,
    description: 'Total burned for the day — resting metabolism plus everything you did on top of it.',
  },
  {
    key: 'stress_avg',
    label: 'Avg stress',
    higherIsBetter: false,
    description:
      "Garmin's all-day 0–100 estimate from heart-rate variability. Under 25 is rest, 26–50 low, 51–75 medium.",
  },
]

/**
 * Wellness rows, refetched whenever the app comes back to the foreground.
 *
 * iOS freezes a home-screen PWA rather than unloading it, and restores it from
 * a snapshot without re-running effects. A mount-only fetch therefore leaves
 * the dashboard showing whatever it read the first time the app was opened —
 * for days, since nothing else invalidates it.
 */
function useGarminWellness() {
  const [rows, setRows] = useState<GarminWellnessRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true

    try {
      const data = await getGarminWellness()
      if (mounted.current) {
        setRows(data)
        setError('')
      }
    } catch (caught) {
      // A failed refresh keeps whatever is already on screen; the note under
      // the header says the refresh failed rather than blanking the card.
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : 'Unable to load Garmin wellness data')
      }
    } finally {
      inFlight.current = false
      if (mounted.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    const onResume = () => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }

    document.addEventListener('visibilitychange', onResume)
    // pageshow fires on a bfcache restore, which visibilitychange does not.
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)

    void (async () => {
      await load()
    })()

    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [load])

  return { rows, isLoading, error, refresh: load }
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

  if (isLoading && rows.length === 0) {
    return <p className="sheets-meta">Loading Garmin data…</p>
  }

  if (error && rows.length === 0) {
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
        <div
          key={String(metric.key)}
          className="garmin-metric"
          /*
           * Focusable so the description is reachable by keyboard and by tap —
           * a hover-only tooltip is invisible on the phone this is mostly read
           * on. The text stays in the DOM at opacity 0 rather than being
           * display:none, so `aria-describedby` still resolves it.
           */
          tabIndex={metric.description ? 0 : undefined}
          aria-describedby={metric.description ? `tip-${String(metric.key)}` : undefined}
        >
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
          {summary?.carried ? (
            <span className="garmin-metric-from">from {formatDayLabel(summary.latest.date)}</span>
          ) : null}

          {/* Last in the DOM so that when it stops floating on a phone and
              expands the tile inline, it reads after the value rather than
              before the label. Absolute positioning makes order irrelevant on
              wider screens. */}
          {metric.description ? (
            <span className="garmin-metric-tip" id={`tip-${String(metric.key)}`} role="tooltip">
              {metric.description}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/**
 * Says plainly how old the newest reading is.
 *
 * Without it the card shows a date and a grid of numbers with nothing to say
 * the watch stopped reporting days ago.
 */
function SyncNote({ rows, error }: { rows: GarminWellnessRecord[]; error: string }) {
  const newest = rows[0]?.date
  if (!newest) return null

  const gap = daysBetween(newest, todayKey())
  if (gap <= 0 && !error) return null

  const staleness =
    gap === 1
      ? `No reading for today yet — newest is yesterday, ${formatDayLabel(newest)}.`
      : gap > 1
        ? `No reading for the last ${gap} days — newest is ${formatDayLabel(newest)}. Check that the Garmin sync is still running.`
        : ''

  return (
    <p className="sheets-meta garmin-sync-note" role="status">
      {staleness}
      {error ? `${staleness ? ' ' : ''}Last refresh failed: ${error}` : ''}
    </p>
  )
}

/** Step back and forth through the days that actually have readings. */
function WellnessDateNav({
  unit,
  dates,
  activeDate,
  onSelect,
}: {
  unit: 'day' | 'week'
  dates: string[]
  activeDate: string
  onSelect: (date: string) => void
}) {
  if (dates.length === 0) return null

  const index = dates.indexOf(activeDate)
  const older = index >= 0 && index < dates.length - 1 ? dates[index + 1] : ''
  const newer = index > 0 ? dates[index - 1] : ''

  return (
    <div className="garmin-date-row">
      <button
        type="button"
        className="garmin-date-step"
        onClick={() => onSelect(older)}
        disabled={!older}
        aria-label={`Previous ${unit}`}
        title={`Previous ${unit}`}
      >
        ‹
      </button>

      <label>
        <span>{unit === 'week' ? 'Week of' : 'Date'}</span>
        <input
          type="date"
          value={activeDate}
          min={dates[dates.length - 1]}
          max={dates[0]}
          onChange={(event) => onSelect(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="garmin-date-step"
        onClick={() => onSelect(newer)}
        disabled={!newer}
        aria-label={`Next ${unit}`}
        title={`Next ${unit}`}
      >
        ›
      </button>

      <span className="sheets-meta">
        {activeDate
          ? unit === 'week'
            ? `Week beginning ${formatDayLabel(activeDate)}`
            : formatDayLabel(activeDate)
          : ''}
      </span>

      {index > 0 ? (
        <button type="button" className="secondary-action" onClick={() => onSelect(dates[0])}>
          Latest
        </button>
      ) : null}
    </div>
  )
}

function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      className="secondary-action"
      onClick={onClick}
      disabled={busy}
      title="Re-read the sheet"
    >
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

/**
 * Shared shell matching the collapse behaviour of the other Health cards
 * (`.section-collapse-btn` with ▾/▸), so every section on the page folds away.
 */
function GarminCard({
  title,
  pill,
  actions,
  defaultCollapsed = false,
  children,
}: {
  title: string
  pill?: string
  actions?: ReactNode
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
          {actions}
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

/**
 * Sleep & recovery. Deliberately not collapsible — it is the reason the
 * Personal page loads, so it is always open.
 */
export function GarminSleepCard({ title }: { title: string }) {
  const { rows, isLoading, error, refresh } = useGarminWellness()
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState('')

  const weekly = useMemo(() => toWeeklyAverages(rows), [rows])
  const source = mode === 'week' ? weekly : rows
  const dates = useMemo(() => source.map((row) => row.date).filter(Boolean), [source])

  // Default to the newest row once data arrives, but let a chosen date stick.
  const activeDate = resolveDate(dates, selectedDate)

  const visible = useMemo(() => {
    if (!activeDate) return source
    const index = source.findIndex((row) => row.date === activeDate)
    return index < 0 ? source : source.slice(index)
  }, [source, activeDate])

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
          <RefreshButton onClick={() => void refresh()} busy={isLoading} />
        </div>
      </div>

      <WellnessDateNav
        unit={mode === 'week' ? 'week' : 'day'}
        dates={dates}
        activeDate={activeDate}
        onSelect={(date) => setSelectedDate(mode === 'week' && date ? weekStartKey(date) : date)}
      />

      {mode === 'day' ? <SyncNote rows={rows} error={error} /> : null}

      <MetricGrid rows={visible} metrics={SLEEP_METRICS} isLoading={isLoading} error={error} />
    </article>
  )
}

export function GarminWellnessCard({ title }: { title: string }) {
  const { rows, isLoading, error, refresh } = useGarminWellness()
  const [selectedDate, setSelectedDate] = useState('')

  const dates = useMemo(() => rows.map((row) => row.date).filter(Boolean), [rows])
  const activeDate = resolveDate(dates, selectedDate)

  const visible = useMemo(() => {
    if (!activeDate) return rows
    const index = rows.findIndex((row) => row.date === activeDate)
    return index < 0 ? rows : rows.slice(index)
  }, [rows, activeDate])

  return (
    <GarminCard
      title={title}
      pill={activeDate ? formatDayLabel(activeDate) : undefined}
      actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
    >
      <WellnessDateNav unit="day" dates={dates} activeDate={activeDate} onSelect={setSelectedDate} />

      <SyncNote rows={rows} error={error} />

      <MetricGrid rows={visible} metrics={WELLNESS_METRICS} isLoading={isLoading} error={error} />
    </GarminCard>
  )
}
