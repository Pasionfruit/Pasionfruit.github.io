import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getGarminWellness, getRingconnHealth } from '../data/sheets/repositories'
import { todayKey } from '../data/todoist/dates'
import type { GarminWellnessRecord, RingconnHealthRecord } from '../data/sheets/types'
import {
  dailyHealthScores,
  daysBetween,
  formatDayLabel,
  formatValue,
  healthSeries,
  isoWeekRating,
  resolveDate,
  summarise,
  toWeeklyAverages,
  trendNote,
  weekRating,
  weekStartKey,
  type Grade,
  type HealthPoint,
  type Metric,
  type MetricSummary,
  type Rating,
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
 * Rows from `fetchRows`, refetched whenever the app comes back to the foreground.
 *
 * iOS freezes a home-screen PWA rather than unloading it, and restores it from
 * a snapshot without re-running effects. A mount-only fetch therefore leaves
 * the dashboard showing whatever it read the first time the app was opened —
 * for days, since nothing else invalidates it.
 */
function useRefetchedRows<Row>(fetchRows: () => Promise<Row[]>, failure: string) {
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true

    try {
      const data = await fetchRows()
      if (mounted.current) {
        setRows(data)
        setError('')
      }
    } catch (caught) {
      // A failed refresh keeps whatever is already on screen; the note under
      // the header says the refresh failed rather than blanking the card.
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : failure)
      }
    } finally {
      inFlight.current = false
      if (mounted.current) {
        setIsLoading(false)
      }
    }
  }, [fetchRows, failure])

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

function useGarminWellness() {
  return useRefetchedRows(getGarminWellness, 'Unable to load Garmin wellness data')
}

function useRingconnHealth() {
  return useRefetchedRows(getRingconnHealth, 'Unable to load RingConn data')
}

type MetricGroup<Row extends { date: string } = GarminWellnessRecord> = { title: string; metrics: Metric<Row>[] }

/**
 * Titled metric grids sharing one set of rows. Loading, error and empty states
 * are said once for the card rather than once per group.
 */
function MetricGroups<Row extends { date: string }>({
  rows,
  groups,
  isLoading,
  error,
  label,
  empty,
}: {
  rows: Row[]
  groups: MetricGroup<Row>[]
  isLoading: boolean
  error: string
  label: string
  empty: ReactNode
}) {
  const summarised = useMemo(
    () =>
      groups.map((group) => ({
        title: group.title,
        summaries: group.metrics.map((metric) => ({ metric, summary: summarise(rows, metric) })),
      })),
    [rows, groups],
  )

  const hasAny = summarised.some((group) => group.summaries.some((entry) => entry.summary !== null))

  if (isLoading && rows.length === 0) {
    return <p className="sheets-meta">Loading {label} data…</p>
  }

  if (error && rows.length === 0) {
    return <p className="sheets-meta">{error}</p>
  }

  if (!hasAny) {
    return <p className="sheets-meta">{empty}</p>
  }

  return (
    <>
      {summarised.map(({ title, summaries }) => (
        <section key={title} className="garmin-metric-group" aria-label={title}>
          <h4 className="garmin-metric-group-title">{title}</h4>
          <MetricGrid summaries={summaries} />
        </section>
      ))}
    </>
  )
}

function GradeBadge({ grade, small = false }: { grade: Grade; small?: boolean }) {
  return (
    <span className={`garmin-grade grade-${grade.toLowerCase()}${small ? ' is-small' : ''}`} title={`Health rating ${grade}`}>
      {grade}
    </span>
  )
}

const GRADE_LINES: { grade: Grade; at: number }[] = [
  { grade: 'A', at: 90 },
  { grade: 'B', at: 80 },
  { grade: 'C', at: 70 },
  { grade: 'D', at: 60 },
]

/** The health score over time, with the grade boundaries drawn so the line reads as A–F. */
function HealthTrendLine({ points, selected }: { points: HealthPoint[]; selected: string }) {
  if (points.length < 2) return null

  const width = 320
  const height = 96
  const pad = { left: 16, right: 6, top: 6, bottom: 6 }
  const low = Math.min(50, ...points.map((point) => point.score))
  const high = 100
  const x = (index: number) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right)
  const y = (score: number) => pad.top + ((high - score) / (high - low)) * (height - pad.top - pad.bottom)
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.score).toFixed(1)}`).join(' ')
  const chosen = points.findIndex((point) => point.label === selected)

  return (
    <svg
      className="garmin-trendline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Health rating over the last ${points.length} entries, from ${points[0].score} to ${points[points.length - 1].score}`}
    >
      {GRADE_LINES.filter((entry) => entry.at > low).map((entry) => (
        <g key={entry.grade}>
          <line x1={pad.left} x2={width - pad.right} y1={y(entry.at)} y2={y(entry.at)} className="garmin-trend-grid" />
          <text x="2" y={y(entry.at) + 3} className="garmin-trend-letter">
            {entry.grade}
          </text>
        </g>
      ))}
      <polyline points={line} className="garmin-trend-path" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].score)} r="3" className="garmin-trend-dot" />
      {chosen >= 0 && chosen < points.length - 1 ? (
        <circle cx={x(chosen)} cy={y(points[chosen].score)} r="3.5" className="garmin-trend-chosen" />
      ) : null}
    </svg>
  )
}

/** Day and week A–F ratings, and the trendline under them. Nothing until two readings make a score. */
function HealthRating({
  mode,
  day,
  week,
  series,
  selected,
}: {
  mode: 'day' | 'week'
  day: { score: number; grade: Grade } | null
  week: Rating | null
  series: HealthPoint[]
  selected: string
}) {
  if (!day && !week && series.length === 0) return null

  return (
    <section className="garmin-health" aria-label="Health rating">
      <div className="garmin-health-ratings">
        {day ? (
          <div className="garmin-rating">
            <GradeBadge grade={day.grade} />
            <span>
              <strong>Day</strong>
              <small>{day.score}/100</small>
            </span>
          </div>
        ) : null}
        {week ? (
          <div className="garmin-rating">
            <GradeBadge grade={week.grade} />
            <span>
              <strong>{mode === 'week' ? 'This week' : 'Week'}</strong>
              <small>
                {week.score}/100 · {week.days} day{week.days === 1 ? '' : 's'}
              </small>
            </span>
          </div>
        ) : null}
      </div>
      <HealthTrendLine points={series} selected={selected} />
      <p className="sheets-meta garmin-health-note">
        Average of sleep, HRV and resting HR against your own recent norm, steps, intensity minutes, stress and body
        battery — whatever the source records. A 90+, B 80+, C 70+, D 60+.
      </p>
    </section>
  )
}

/** A fortnight's readings as a tiny line, so a tile shows the shape and not just today's number. */
function Sparkline({ values, tone }: { values: number[]; tone: 'good' | 'bad' | 'flat' }) {
  if (values.length < 3) return null

  const width = 64
  const height = 18
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const points = values
    .map((value, index) => `${((index / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((value - min) / range) * (height - 4)).toFixed(1)}`)
    .join(' ')
  const last = points.split(' ').at(-1)?.split(',') ?? ['0', '0']

  return (
    <svg className={`garmin-sparkline ${tone}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2" />
    </svg>
  )
}

function MetricGrid<Row extends { date: string }>({
  summaries,
}: {
  summaries: { metric: Pick<Metric<Row>, 'key' | 'label' | 'unit' | 'description'>; summary: MetricSummary | null }[]
}) {
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
          {summary ? (
            <Sparkline values={summary.series} tone={summary.good === null ? 'flat' : summary.good ? 'good' : 'bad'} />
          ) : null}
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
function SyncNote({
  rows,
  error,
  source = 'Garmin sync',
}: {
  rows: { date: string }[]
  error: string
  source?: string
}) {
  const newest = rows[0]?.date
  if (!newest) return null

  const gap = daysBetween(newest, todayKey())
  if (gap <= 0 && !error) return null

  const staleness =
    gap === 1
      ? `No reading for today yet — newest is yesterday, ${formatDayLabel(newest)}.`
      : gap > 1
        ? `No reading for the last ${gap} days — newest is ${formatDayLabel(newest)}. Check that the ${source} is still running.`
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
  actions,
  className = '',
  defaultCollapsed = false,
  collapsed,
  onCollapsedChange,
  note,
  lead,
  children,
}: {
  title: string
  /** Controls on the right of the header, left of the collapse button. */
  actions?: ReactNode
  className?: string
  defaultCollapsed?: boolean
  /** Controlled collapse state, for a card whose body remounts (the wellness source switch). */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** A one-line summary shown beside the collapse button while collapsed; the header's controls hide with it. */
  note?: ReactNode
  /** Controls on the left of the header, right after the title, while expanded. */
  lead?: ReactNode
  children: ReactNode
}) {
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed)
  const isCollapsed = collapsed ?? ownCollapsed
  const setIsCollapsed = (next: boolean) => (onCollapsedChange ?? setOwnCollapsed)(next)

  return (
    <article className={`info-card admin-card ${className}${isCollapsed ? ' is-collapsed' : ''}`.trim()}>
      <div className="admin-card-head">
        <h3>{title}</h3>
        {isCollapsed ? (
          note !== undefined ? <div className="garmin-head-lead">{note}</div> : null
        ) : lead ? (
          <div className="garmin-head-lead">{lead}</div>
        ) : null}
        <div className="admin-card-actions">
          {isCollapsed && note !== undefined ? null : actions}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isCollapsed ? null : children}
    </article>
  )
}

const WELLNESS_GROUPS: MetricGroup[] = [
  { title: 'Sleep & recovery', metrics: SLEEP_METRICS },
  { title: 'Activity', metrics: WELLNESS_METRICS },
]

/*
 * The ring reaches us through Apple Health, which carries no HRV, skin
 * temperature or sleep score for it, so those are not offered. Sleep stays a
 * dash until the ring has been worn for a night.
 */
const RINGCONN_GROUPS: MetricGroup<RingconnHealthRecord>[] = [
  {
    title: 'Sleep & recovery',
    metrics: [
      { key: 'sleep_duration_h', label: 'Time asleep', unit: 'h', higherIsBetter: true, description: 'Hours asleep, from the ring via Apple Health.' },
      { key: 'deep_sleep_h', label: 'Deep', unit: 'h', higherIsBetter: true },
      { key: 'rem_sleep_h', label: 'REM', unit: 'h', higherIsBetter: true },
      {
        key: 'resting_hr',
        label: 'Resting HR',
        unit: 'bpm',
        higherIsBetter: false,
        description: 'Lowest sustained heart rate the ring recorded. A jump of several bpm often shows up a day before you feel run down.',
      },
    ],
  },
  {
    title: 'Activity',
    metrics: [
      { key: 'steps', label: 'Steps', higherIsBetter: true, description: 'Total steps recorded across the day.' },
      { key: 'calories', label: 'Active energy', unit: 'kcal', higherIsBetter: true, description: 'Calories burned on top of resting metabolism.' },
    ],
  },
]

type WellnessSource = 'garmin' | 'ringconn'

const SOURCE_LABELS: Record<WellnessSource, string> = { garmin: 'Garmin', ringconn: 'RingConn' }

/**
 * Daily wellness: last night's sleep and recovery and the day's activity on
 * one card, under one date. Day / Week avg switches both groups together, and
 * the source switch picks whose numbers they are: the Garmin watch or the
 * RingConn ring.
 *
 * No date pill in the header — the date row under it already names the day.
 */
export function GarminWellnessCard({ title, defaultCollapsed = true }: { title: string; defaultCollapsed?: boolean }) {
  const [source, setSource] = useState<WellnessSource>('garmin')
  // Held here, not in the panel: the panel remounts when the source switches, and the
  // card should stay open (or shut) through that.
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const garmin = useGarminWellness()
  const ringconn = useRingconnHealth()

  // Keyed by source so each starts on its own newest day in Day mode.
  return source === 'garmin' ? (
    <WellnessPanel
      key="garmin"
      title={title}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      source={source}
      onSource={setSource}
      data={garmin}
      groups={WELLNESS_GROUPS}
      syncName="Garmin sync"
      empty={
        <>
          No Garmin wellness data yet. Run{' '}
          <code>python scripts/health-ingestion/ingest_garmin_wellness.py --days 30</code> after
          creating the <code>garmin_wellness</code> sheet.
        </>
      }
    />
  ) : (
    <WellnessPanel
      key="ringconn"
      title={title}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      source={source}
      onSource={setSource}
      data={ringconn}
      groups={RINGCONN_GROUPS}
      syncName="RingConn Shortcut"
      empty="No RingConn data yet. Run the Shortcut described in scripts/health-ingestion/README.md."
    />
  )
}

function WellnessPanel<Row extends { date: string }>({
  title,
  collapsed,
  onCollapsedChange,
  source,
  onSource,
  data,
  groups,
  syncName,
  empty,
}: {
  title: string
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  source: WellnessSource
  onSource: (source: WellnessSource) => void
  data: { rows: Row[]; isLoading: boolean; error: string; refresh: () => Promise<void> }
  groups: MetricGroup<Row>[]
  syncName: string
  empty: ReactNode
}) {
  const { rows, isLoading, error, refresh } = data
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState('')

  const weekly = useMemo(() => toWeeklyAverages(rows), [rows])
  const shown = mode === 'week' ? weekly : rows
  const dates = useMemo(() => shown.map((row) => row.date).filter(Boolean), [shown])

  // Default to the newest row once data arrives, but let a chosen date stick.
  const activeDate = resolveDate(dates, selectedDate)

  const visible = useMemo(() => {
    if (!activeDate) return shown
    const index = shown.findIndex((row) => row.date === activeDate)
    return index < 0 ? shown : shown.slice(index)
  }, [shown, activeDate])

  // A 0–100 rating per day (A–F), from whatever the source records; see HEALTH_PARTS.
  const scores = useMemo(() => dailyHealthScores(rows, todayKey()), [rows])

  // The collapsed card says how things are moving in a line, against the newest day.
  const note = useMemo(() => {
    const newest = rows[0]?.date
    if (!newest && isLoading) return { tone: 'none' as const, text: 'Loading…', grade: null, week: null }
    if (!newest) return { tone: 'none' as const, text: error || 'No readings yet.', grade: null, week: null }

    const trend = trendNote(rows, groups.flatMap((group) => group.metrics))
    const gap = daysBetween(newest, todayKey())
    // Only when the newest day has a rating of its own: an older day's grade beside this line would mislead.
    const latest = scores[0]?.date === newest ? scores[0] : undefined
    return {
      ...trend,
      text: gap > 0 ? `${trend.text} (as of ${formatDayLabel(newest)})` : trend.text,
      grade: latest?.grade ?? null,
      week: latest ? weekRating(scores, latest.date) : null,
    }
  }, [rows, groups, isLoading, error, scores])

  // The rating for what the card is showing: that day and the week to it, or that week.
  const dayScore = mode === 'day' ? scores.find((entry) => entry.date === activeDate) : undefined
  const week = !activeDate ? null : mode === 'week' ? isoWeekRating(scores, activeDate) : weekRating(scores, activeDate)
  const series = useMemo(() => healthSeries(scores, mode), [scores, mode])

  return (
    <GarminCard
      title={title}
      className="garmin-wellness-card"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      note={
        <p className={`garmin-collapsed-note ${note.tone}`} role="status">
          {note.grade ? <GradeBadge grade={note.grade} small /> : null}
          {note.week ? <span className="garmin-note-week">Week {note.week.grade} · </span> : null}
          {note.text}
        </p>
      }
      lead={
        <>
          <div className="garmin-mode-toggle" role="group" aria-label="Data source">
            {(Object.keys(SOURCE_LABELS) as WellnessSource[]).map((key) => (
              <button
                key={key}
                type="button"
                className={source === key ? 'active' : ''}
                aria-pressed={source === key}
                onClick={() => onSource(key)}
              >
                {SOURCE_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="garmin-mode-toggle" role="group" aria-label="Averaging period">
            <button
              type="button"
              className={mode === 'day' ? 'active' : ''}
              aria-pressed={mode === 'day'}
              onClick={() => { setMode('day'); setSelectedDate('') }}
            >
              Day
            </button>
            <button
              type="button"
              className={mode === 'week' ? 'active' : ''}
              aria-pressed={mode === 'week'}
              onClick={() => { setMode('week'); setSelectedDate('') }}
            >
              Week avg
            </button>
          </div>
        </>
      }
      actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
    >
      <WellnessDateNav
        unit={mode === 'week' ? 'week' : 'day'}
        dates={dates}
        activeDate={activeDate}
        onSelect={(date) => setSelectedDate(mode === 'week' && date ? weekStartKey(date) : date)}
      />

      {mode === 'day' ? <SyncNote rows={rows} error={error} source={syncName} /> : null}

      <HealthRating
        mode={mode}
        day={dayScore ? { score: dayScore.score, grade: dayScore.grade } : null}
        week={week}
        series={series}
        selected={activeDate}
      />

      <MetricGroups
        rows={visible}
        groups={groups}
        isLoading={isLoading}
        error={error}
        label={SOURCE_LABELS[source]}
        empty={empty}
      />
    </GarminCard>
  )
}
