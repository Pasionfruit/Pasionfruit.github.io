/**
 * Workout text as stored in `training_records.morning_workout` / `evening_workout`.
 *
 * A workout is plain text, one line per line: an optional `**bold**` title and
 * `•` bullets, e.g. "**Easy swim**\n• 100m breast\n• 4×50m free". That is the
 * shape a pasted Markdown plan already has once its `<br>`s become newlines, so
 * storing it as-is keeps the textarea editable by hand and the D1 column a
 * plain string. A one-word workout ("Legs") is just a one-line workout.
 */

export type WorkoutSegment = { text: string; bold: boolean }
export type WorkoutLine = { kind: 'item' | 'text'; segments: WorkoutSegment[] }

const BULLET = /^[•\-*]\s+/

function segments(line: string): WorkoutSegment[] {
  // Split on **bold** runs; odd indexes are the bold parts.
  return line
    .split(/\*\*(.+?)\*\*/)
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((segment) => segment.text)
}

export function workoutLines(value: string | undefined): WorkoutLine[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      BULLET.test(line)
        ? { kind: 'item' as const, segments: segments(line.replace(BULLET, '')) }
        : { kind: 'text' as const, segments: segments(line) },
    )
}

/** "Easy swim: 100m breast; 4×50m free" — for places that need a single line. */
export function workoutOneLine(value: string | undefined): string {
  const lines = workoutLines(value).map((line) => line.segments.map((segment) => segment.text).join(''))
  if (lines.length <= 1) return lines[0] ?? ''

  const [first, ...rest] = lines
  return `${first}: ${rest.join('; ')}`
}

// ── Pasted plans ─────────────────────────────────────────────────────────────

export type PlanDay = { weekday: number; morning: string; evening: string }
export type ParsedPlan = { days: PlanDay[]; skipped: string[]; error?: string }

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** 0 = Sunday, matching Date.getDay(); -1 when the cell is not a weekday. */
export function weekdayIndex(cell: string): number {
  return WEEKDAYS.indexOf(cell.replace(/\*/g, '').trim().toLowerCase().slice(0, 3))
}

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|')) row = row.slice(0, -1)
  return row.split('|').map((cell) => cell.trim())
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-+:?$/.test(cell))
}

function cleanCell(cell: string | undefined): string {
  return (cell ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Read a Markdown table of `Day | Morning | Evening` rows.
 *
 * The header is optional and only used to find the columns, so the order can
 * differ ("Day | Evening | Morning") or be absent entirely, in which case the
 * columns are taken as day, morning, evening. Rows whose day is not a weekday
 * are reported back rather than dropped silently.
 */
export function parseWorkoutTable(text: string): ParsedPlan {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.includes('|'))
    .map(splitRow)
    .filter((cells) => !isSeparatorRow(cells))

  let columns = { day: 0, morning: 1, evening: 2 }
  let body = rows

  if (rows.length > 0 && weekdayIndex(rows[0][0] ?? '') < 0) {
    const header = rows[0].map((cell) => cell.replace(/\*/g, '').trim().toLowerCase())
    const find = (pattern: RegExp, fallback: number) => {
      const index = header.findIndex((cell) => pattern.test(cell))
      return index >= 0 ? index : fallback
    }
    columns = {
      day: find(/\bday\b/, 0),
      morning: find(/morning|\bam\b/, 1),
      evening: find(/evening|night|\bpm\b/, 2),
    }
    body = rows.slice(1)
  }

  const days: PlanDay[] = []
  const skipped: string[] = []

  for (const cells of body) {
    const weekday = weekdayIndex(cells[columns.day] ?? '')
    if (weekday < 0) {
      skipped.push(cells[columns.day] || '(blank day)')
      continue
    }
    days.push({ weekday, morning: cleanCell(cells[columns.morning]), evening: cleanCell(cells[columns.evening]) })
  }

  if (days.length === 0) {
    return {
      days,
      skipped,
      error: 'No workout rows found. Paste a table with rows like "| Wed | Easy swim | Legs |".',
    }
  }

  return { days, skipped }
}

/**
 * Give each pasted day a date, in the order pasted.
 *
 * The first row lands on its next occurrence counting today; every later row on
 * the next occurrence after the row before it. So a Wed–Sun plan pasted on a
 * Tuesday covers tomorrow through Sunday, and a Saturday that follows a Friday
 * is the coming Saturday, not last weekend's.
 */
export function assignPlanDates(days: PlanDay[], from: Date): Array<PlanDay & { date: Date }> {
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)

  return days.map((day, index) => {
    let offset = (day.weekday - cursor.getDay() + 7) % 7
    if (index > 0 && offset === 0) offset = 7
    cursor.setDate(cursor.getDate() + offset)
    return { ...day, date: new Date(cursor) }
  })
}
