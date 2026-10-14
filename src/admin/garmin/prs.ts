import type { GarminPrRecord } from '../../data/sheets/types'

const METERS_PER_MILE = 1609.344
const FEET_PER_METER = 3.28084
const METERS_PER_YARD = 0.9144

/** A record set this recently wears a "New" badge. */
export const NEW_PR_DAYS = 30

export type PrGroup = 'race' | 'distance' | 'more'

type PrKind = 'time' | 'distance' | 'climb' | 'count' | 'days'

type PrType = {
  typeId: number
  label: string
  group: PrGroup
  kind: PrKind
  sport: 'run' | 'bike' | 'swim' | 'steps'
  /** For a timed record, the distance it covers: for pace, and for progress before it is set. */
  meters?: number
}

/*
 * Garmin's PR type ids. Garmin publishes no catalogue, so these were read off
 * a real account, where each value only makes sense one way (1958 s is a 5K,
 * 11072 m a long run, 23400 a day of steps). 5 and 6 (half and marathon) carry
 * on from 3 and 4 in the same numbering. Ids not listed (16, a running streak,
 * and the bike-power records) are skipped rather than guessed at.
 */
export const PR_TYPES: PrType[] = [
  { typeId: 1, label: '1K', group: 'race', kind: 'time', sport: 'run', meters: 1000 },
  { typeId: 2, label: 'Mile', group: 'race', kind: 'time', sport: 'run', meters: METERS_PER_MILE },
  { typeId: 3, label: '5K', group: 'race', kind: 'time', sport: 'run', meters: 5000 },
  { typeId: 4, label: '10K', group: 'race', kind: 'time', sport: 'run', meters: 10000 },
  { typeId: 5, label: 'Half marathon', group: 'race', kind: 'time', sport: 'run', meters: 21097.5 },
  { typeId: 6, label: 'Marathon', group: 'race', kind: 'time', sport: 'run', meters: 42195 },
  { typeId: 7, label: 'Longest run', group: 'distance', kind: 'distance', sport: 'run' },
  { typeId: 8, label: 'Longest ride', group: 'distance', kind: 'distance', sport: 'bike' },
  { typeId: 17, label: 'Longest swim', group: 'distance', kind: 'distance', sport: 'swim' },
  { typeId: 18, label: 'Fastest 100', group: 'more', kind: 'time', sport: 'swim', meters: 100 },
  { typeId: 9, label: 'Biggest ride climb', group: 'more', kind: 'climb', sport: 'bike' },
  { typeId: 12, label: 'Most steps in a day', group: 'more', kind: 'count', sport: 'steps' },
  { typeId: 13, label: 'Most steps in a week', group: 'more', kind: 'count', sport: 'steps' },
  { typeId: 14, label: 'Most steps in a month', group: 'more', kind: 'count', sport: 'steps' },
  { typeId: 15, label: 'Longest step-goal streak', group: 'more', kind: 'days', sport: 'steps' },
]

export type PrTile = {
  typeId: number
  label: string
  group: PrGroup
  /** The record, formatted; '' when it has not been set yet. */
  value: string
  /** Pace or unit context, e.g. "10:30 /mi". */
  detail: string
  /** YYYY-MM-DD it was set, or ''. */
  date: string
  isNew: boolean
  /** The next round number to chase, e.g. "Sub-32:00 · 38 s to cut". */
  goal: string
  /** 0–1 toward a race distance not run yet; null otherwise. */
  progress: number | null
}

export type PrBoard = Record<PrGroup, PrTile[]>

/** 1957.7 → "32:38", 3846.9 → "1:04:07", 58 → "0:58". */
export function formatClock(seconds: number): string {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

function formatGap(seconds: number): string {
  return seconds < 60 ? `${Math.round(seconds)} s` : formatClock(seconds)
}

/** The step a time goal moves in: 5 s under ten minutes, a minute under two hours, then five. */
function timeStep(seconds: number) {
  if (seconds < 600) return 5
  if (seconds < 7200) return 60
  return 300
}

/** A round step about half the value's order of magnitude: 23,400 → 5,000. */
function niceStep(value: number) {
  return Math.max(1, 10 ** Math.floor(Math.log10(Math.max(value, 1))) / 2)
}

function nextAbove(value: number, step: number) {
  return (Math.floor(value / step) + 1) * step
}

function daysBetween(dateKey: string, today: Date) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return Infinity
  const then = new Date(year, month - 1, day)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((now.getTime() - then.getTime()) / 86_400_000)
}

function swimUnit(record: GarminPrRecord) {
  return record.pool_unit === 'yard' ? 'yd' : 'm'
}

function setTile(type: PrType, record: GarminPrRecord, today: Date): PrTile {
  const raw = Number.parseFloat(record.value)
  const base = {
    typeId: type.typeId,
    group: type.group,
    date: record.date,
    isNew: daysBetween(record.date, today) <= NEW_PR_DAYS,
    progress: null,
  }

  if (type.kind === 'time') {
    const seconds = Math.round(raw)
    const step = timeStep(seconds)
    const target = (Math.ceil(seconds / step) - 1) * step
    const isSwim = type.sport === 'swim'
    // Non-breaking, so a narrow tile never strands the unit on its own line.
    const label = isSwim ? `${type.label}\u00a0${swimUnit(record)}` : type.label
    const detail =
      type.sport === 'run' && type.meters
        ? `${formatClock(seconds / (type.meters / METERS_PER_MILE))} /mi`
        : ''
    return {
      ...base,
      label,
      value: formatClock(seconds),
      detail,
      goal: target > 0 ? `Sub-${formatClock(target)} · ${formatGap(seconds - target)} to cut` : '',
    }
  }

  if (type.kind === 'distance') {
    if (type.sport === 'swim') {
      const unit = swimUnit(record)
      const amount = unit === 'yd' ? raw / METERS_PER_YARD : raw
      const target = nextAbove(amount, 250)
      return {
        ...base,
        label: type.label,
        value: `${Math.round(amount).toLocaleString('en-US')} ${unit}`,
        detail: '',
        goal: `${target.toLocaleString('en-US')} ${unit} next · ${Math.round(target - amount)} ${unit} to go`,
      }
    }
    const miles = raw / METERS_PER_MILE
    const target = nextAbove(miles, 1)
    return {
      ...base,
      label: type.label,
      value: `${miles.toFixed(2)} mi`,
      detail: '',
      goal: `${target} mi next · ${(target - miles).toFixed(2)} mi to go`,
    }
  }

  if (type.kind === 'climb') {
    const feet = raw * FEET_PER_METER
    const target = nextAbove(feet, niceStep(feet))
    return {
      ...base,
      label: type.label,
      value: `${Math.round(feet).toLocaleString('en-US')} ft`,
      detail: '',
      goal: `${target.toLocaleString('en-US')} ft next · ${Math.round(target - feet)} ft to go`,
    }
  }

  if (type.kind === 'days') {
    const days = Math.round(raw)
    return {
      ...base,
      label: type.label,
      value: `${days} ${days === 1 ? 'day' : 'days'}`,
      detail: '',
      goal: `${days + 1} days next`,
    }
  }

  const count = Math.round(raw)
  const target = nextAbove(count, niceStep(count))
  return {
    ...base,
    label: type.label,
    value: count.toLocaleString('en-US'),
    detail: 'steps',
    goal: `${target.toLocaleString('en-US')} next · ${(target - count).toLocaleString('en-US')} to go`,
  }
}

/** A race distance with no record yet: how far the longest run gets toward it. */
function unsetRaceTile(type: PrType, longestRunMeters: number): PrTile {
  const distanceMiles = (type.meters ?? 0) / METERS_PER_MILE
  const longestMiles = longestRunMeters / METERS_PER_MILE
  return {
    typeId: type.typeId,
    label: type.label,
    group: type.group,
    value: '',
    detail: '',
    date: '',
    isNew: false,
    goal:
      longestMiles > 0
        ? `Longest run ${longestMiles.toFixed(1)} of ${distanceMiles.toFixed(1)} mi`
        : `${distanceMiles.toFixed(1)} mi to go`,
    progress: longestMiles > 0 ? Math.min(0.99, longestMiles / distanceMiles) : 0,
  }
}

/**
 * The PR board: every race distance (set or still to chase), then the
 * distance bests and everything else Garmin tracks, in catalogue order.
 */
export function buildPrBoard(records: GarminPrRecord[], today = new Date()): PrBoard {
  const byType = new Map(records.map((record) => [Number(record.type_id), record]))
  const longestRun = Number.parseFloat(byType.get(7)?.value ?? '') || 0
  const board: PrBoard = { race: [], distance: [], more: [] }

  for (const type of PR_TYPES) {
    const record = byType.get(type.typeId)
    const raw = Number.parseFloat(record?.value ?? '')
    if (record && Number.isFinite(raw) && raw > 0) {
      board[type.group].push(setTile(type, record, today))
    } else if (type.group === 'race') {
      board.race.push(unsetRaceTile(type, longestRun))
    }
  }

  return board
}
