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

/** Copied tables may quote multiline cells or put continuation lines below a row. */
function tabRows(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  const addRow = (row: string[]) => {
    if (row.length > 1) {
      rows.push(row)
    } else if (row[0] && rows.length > 0) {
      const previous = rows[rows.length - 1]
      previous[previous.length - 1] += `\n${row[0]}`
    }
  }
  const input = text.replace(/\r\n?/g, '\n')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"' && (quoted || cell === '')) {
      if (quoted && input[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && (char === '\t' || char === '\n')) {
      cells.push(cell.trim())
      cell = ''
      if (char === '\n') {
        addRow(cells)
        cells = []
      }
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  addRow(cells)
  return rows
}

/** Mobile cards can copy as a day followed by Morning / Evening labels. */
function stackedRows(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] | undefined
  let column: 1 | 2 | undefined
  let hasLabel = false
  for (const line of text.split(/\r?\n/)) {
    const plain = line.replace(/\*\*/g, '').replace(/^#{1,6}\s+/, '').trim()
    if (/^(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)(?:\s+\d.*)?[:\s]*$/i.test(plain)) {
      if (cells && hasLabel) rows.push(cells)
      cells = [plain, '', '']
      column = undefined
      hasLabel = false
      continue
    }
    if (!cells) continue
    const label = /^(morning(?: workout)?|am|afternoon(?: workout)?|evening(?: workout)?|night|pm)(?:\s*[:–—-]\s*(.*)|\s*)$/i.exec(plain)
    if (label) {
      column = /^(morning|am)/i.test(label[1]) ? 1 : 2
      hasLabel = true
      cells[column] = label[2] ?? ''
    } else if (column && line.trim()) {
      cells[column] += `${cells[column] ? '\n' : ''}${line.trim()}`
    }
  }
  if (cells && hasLabel) rows.push(cells)
  return rows
}

/**
 * Read Markdown, tab-separated tables, or labeled mobile day cards.
 *
 * The header is optional and only used to find the columns, so the order can
 * differ ("Day | Evening | Morning") or be absent entirely, in which case the
 * columns are taken as day, morning, evening. Rows whose day is not a weekday
 * are reported back rather than dropped silently.
 */
export function parseWorkoutTable(text: string): ParsedPlan {
  const rows = (text.includes('\t')
    ? tabRows(text)
    : text.includes('|')
      ? text.split(/\r?\n/).filter((line) => line.includes('|')).map(splitRow)
      : stackedRows(text)
  ).filter((cells) => !isSeparatorRow(cells))

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
      evening: find(/afternoon|evening|night|\bpm\b/, 2),
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
      error: 'No workout rows found. Paste a Day / Morning / Afternoon or Evening table, or mobile day cards with workout labels.',
    }
  }

  return { days, skipped }
}

/**
 * Give each pasted weekday its next date, counting today.
 *
 * A Monday–Sunday plan pasted midweek still fills the upcoming seven days.
 * Repeated weekdays advance to the following week for each occurrence.
 */
export function assignPlanDates(days: PlanDay[], from: Date): Array<PlanDay & { date: Date }> {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const occurrences = new Map<number, number>()

  return days.map((day) => {
    const occurrence = occurrences.get(day.weekday) ?? 0
    const offset = (day.weekday - start.getDay() + 7) % 7 + occurrence * 7
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    occurrences.set(day.weekday, occurrence + 1)
    return { ...day, date }
  })
}
