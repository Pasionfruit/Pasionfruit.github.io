import type { GarminHealthRecord } from '../../data/sheets/types'

export type TrainingView = 'workouts' | 'runs' | 'swims' | 'bikes'

export const TRAINING_VIEWS: { id: TrainingView; label: string; noun: string }[] = [
  { id: 'workouts', label: 'Workouts', noun: 'workouts' },
  { id: 'runs', label: 'Runs', noun: 'runs' },
  { id: 'swims', label: 'Swims', noun: 'swims' },
  { id: 'bikes', label: 'Bikes', noun: 'rides' },
]

const METERS_PER_MILE = 1609.344

type Sport = 'run' | 'swim' | 'bike' | 'other'

/** Which sport an activity counts toward, from Garmin's activity type key. */
export function sportOf(activityType: string): Sport {
  const type = activityType.toLowerCase()
  // Swim first: "open_water_swimming" must not fall through to anything else.
  if (type.includes('swim')) return 'swim'
  if (type.includes('run')) return 'run' // running, treadmill_running, trail_running
  if (/cycl|bik|ride/.test(type)) return 'bike' // cycling, indoor_cycling, road_biking, virtual_ride
  return 'other'
}

const VIEW_SPORT: Record<Exclude<TrainingView, 'workouts'>, Sport> = { runs: 'run', swims: 'swim', bikes: 'bike' }

export function activitiesFor(view: TrainingView, rows: GarminHealthRecord[]): GarminHealthRecord[] {
  if (view === 'workouts') return rows
  return rows.filter((row) => sportOf(row.activity_type) === VIEW_SPORT[view])
}

/** "treadmill_running" → "Treadmill running". */
export function activityLabel(type: string): string {
  const words = type.replace(/_/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : ''
}

function positive(value: string): number | null {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function clock(seconds: number): string {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

/** Swims are stored in miles like everything else; swimmers think in meters. */
export function swimMeters(row: GarminHealthRecord): number | null {
  const miles = positive(row.distance_mi)
  return miles === null ? null : miles * METERS_PER_MILE
}

function pacePerMile(miles: number, minutes: number) {
  return `${clock((minutes * 60) / miles)} /mi`
}

function pacePer100m(meters: number, minutes: number) {
  return `${clock((minutes * 60) / (meters / 100))} /100m`
}

function speedMph(miles: number, minutes: number) {
  return `${(miles / (minutes / 60)).toFixed(1)} mph`
}

function rowPace(view: TrainingView, row: GarminHealthRecord): string {
  const minutes = positive(row.duration_min)
  if (minutes === null) return ''
  if (view === 'swims') {
    const meters = swimMeters(row)
    return meters === null ? '' : pacePer100m(meters, minutes)
  }
  const miles = positive(row.distance_mi)
  if (miles === null) return ''
  return view === 'bikes' ? speedMph(miles, minutes) : pacePerMile(miles, minutes)
}

/** What each view charts, one point per activity. */
export const VIEW_CHART: Record<
  TrainingView,
  { label: string; unit: string; color: string; value: (row: GarminHealthRecord) => number | null }
> = {
  workouts: { label: 'Time per workout', unit: 'min', color: '#6366f1', value: (row) => positive(row.duration_min) },
  runs: { label: 'Distance per run', unit: 'mi', color: '#f97316', value: (row) => positive(row.distance_mi) },
  swims: { label: 'Distance per swim', unit: 'm', color: '#0ea5e9', value: swimMeters },
  bikes: { label: 'Distance per ride', unit: 'mi', color: '#16a34a', value: (row) => positive(row.distance_mi) },
}

export type TrainingColumn = {
  label: string
  value: (row: GarminHealthRecord) => string
  /** Kept on a phone, where the full set does not fit. */
  compact?: boolean
}

const dateColumn: TrainingColumn = { label: 'Date', value: (row) => row.date.slice(0, 10), compact: true }
const titleColumn: TrainingColumn = { label: 'Title', value: (row) => row.title }
const timeColumn: TrainingColumn = { label: 'Time', value: (row) => (positive(row.duration_min) ? `${row.duration_min} min` : '') }
const hrColumn: TrainingColumn = { label: 'Avg HR', value: (row) => row.avg_hr }
const milesColumn: TrainingColumn = { label: 'Distance', value: (row) => (positive(row.distance_mi) ? `${row.distance_mi} mi` : ''), compact: true }

export const VIEW_COLUMNS: Record<TrainingView, TrainingColumn[]> = {
  workouts: [
    dateColumn,
    { label: 'Type', value: (row) => activityLabel(row.activity_type), compact: true },
    titleColumn,
    { ...timeColumn, compact: true },
    hrColumn,
    { label: 'Calories', value: (row) => row.calories },
  ],
  runs: [dateColumn, titleColumn, milesColumn, timeColumn, { label: 'Pace', value: (row) => rowPace('runs', row), compact: true }, hrColumn],
  swims: [
    dateColumn,
    titleColumn,
    {
      label: 'Distance',
      value: (row) => {
        const meters = swimMeters(row)
        return meters === null ? '' : `${Math.round(meters).toLocaleString('en-US')} m`
      },
      compact: true,
    },
    timeColumn,
    { label: 'Pace', value: (row) => rowPace('swims', row), compact: true },
    hrColumn,
  ],
  bikes: [dateColumn, titleColumn, milesColumn, timeColumn, { label: 'Speed', value: (row) => rowPace('bikes', row), compact: true }, hrColumn],
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shortDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return dateKey
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0)

/** The last 30 days of one view: three stat tiles and a line of commentary. */
export function viewSummary(
  view: TrainingView,
  rows: GarminHealthRecord[],
  today = new Date(),
): { tiles: { label: string; value: string }[]; note: string } {
  const cutoff = new Date(today)
  cutoff.setDate(today.getDate() - 30)
  const since = localDayKey(cutoff)
  const recent = activitiesFor(view, rows).filter((row) => row.date.slice(0, 10) >= since)
  const noun = TRAINING_VIEWS.find((entry) => entry.id === view)?.noun ?? view
  const count = recent.length
  const countTile = { label: `${noun[0].toUpperCase()}${noun.slice(1)} / 30d`, value: count > 0 ? String(count) : '—' }

  if (view === 'workouts') {
    const hours = sum(recent.map((row) => positive(row.duration_min))) / 60
    const days = new Set(recent.map((row) => row.date.slice(0, 10))).size
    let note = ''
    if (count >= 16) note = `${count} workouts in the last 30 days. Consistency is high.`
    else if (count > 0 && count < 8) note = 'Training frequency is low. Aim for a few more sessions.'
    return {
      tiles: [
        countTile,
        { label: 'Hours', value: hours > 0 ? hours.toFixed(1) : '—' },
        { label: 'Active days', value: days > 0 ? String(days) : '—' },
      ],
      note,
    }
  }

  if (count === 0) {
    return {
      tiles: [countTile, { label: 'Distance', value: '—' }, { label: view === 'bikes' ? 'Avg speed' : 'Avg pace', value: '—' }],
      note: `No ${noun} in the last 30 days.`,
    }
  }

  // Pace and speed only count sessions with a distance: an indoor ride with no
  // distance would otherwise add its minutes and drag the average down.
  const minutes = sum(
    recent.filter((row) => positive(row.distance_mi) !== null).map((row) => positive(row.duration_min)),
  )
  // Longest in the window, for a line worth chasing.
  const longest = recent.reduce((best, row) => ((positive(row.distance_mi) ?? 0) > (positive(best.distance_mi) ?? 0) ? row : best))

  if (view === 'swims') {
    const meters = sum(recent.map(swimMeters))
    const longestMeters = swimMeters(longest) ?? 0
    return {
      tiles: [
        countTile,
        { label: 'Meters', value: Math.round(meters).toLocaleString('en-US') },
        { label: 'Avg pace', value: meters > 0 && minutes > 0 ? pacePer100m(meters, minutes) : '—' },
      ],
      note: longestMeters > 0 ? `Longest swim: ${Math.round(longestMeters).toLocaleString('en-US')} m on ${shortDate(longest.date.slice(0, 10))}.` : '',
    }
  }

  const miles = sum(recent.map((row) => positive(row.distance_mi)))
  const longestMiles = positive(longest.distance_mi) ?? 0
  return {
    tiles: [
      countTile,
      { label: 'Miles', value: miles.toFixed(1) },
      view === 'bikes'
        ? { label: 'Avg speed', value: miles > 0 && minutes > 0 ? speedMph(miles, minutes) : '—' }
        : { label: 'Avg pace', value: miles > 0 && minutes > 0 ? pacePerMile(miles, minutes) : '—' },
    ],
    note:
      longestMiles > 0
        ? `Longest ${view === 'bikes' ? 'ride' : 'run'}: ${longestMiles.toFixed(1)} mi on ${shortDate(longest.date.slice(0, 10))}.`
        : '',
  }
}
