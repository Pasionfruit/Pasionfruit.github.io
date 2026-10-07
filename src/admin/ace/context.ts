import {
  getCalendarEvents,
  getEvents,
  getGarminHealth,
  getGarminWellness,
  getJournalEntries,
  getMail,
  getPersonalTraining,
  getTrainingRecords,
} from '../../data/sheets/repositories'
import type { CalendarEventRecord, MailSummaryRecord } from '../../data/sheets/repositories'
import type {
  EventRecord,
  GarminHealthRecord,
  GarminWellnessRecord,
  JournalEntryRecord,
  PersonalTrainingRecord,
  TrainingRecord,
} from '../../data/sheets/types'
import { getActiveTasks, getCompletedTasks } from '../../data/todoist/repositories'
import { addDaysToKey, dateFromKey, dueDateKey, todayKey, toLocalDateKey } from '../../data/todoist/dates'
import type { TodoistTask } from '../../data/todoist/types'
import { moodScore } from '../journal/moods'

/**
 * Everything Ace is shown about Abe, gathered client-side.
 *
 * Deliberately not a retrieval index. The volume here is a few hundred rows at
 * most — it fits in the prompt whole, which is both simpler and more faithful
 * than a vector store that has to be kept in sync with this many sources.
 *
 * Every field is optional in practice: any source can fail (Apps Script not
 * deployed, Todoist token missing, no watch data yet) and Ace still has to
 * answer, so failures are collected rather than thrown.
 */
export type AceContext = {
  now: Date
  mail: MailSummaryRecord[]
  events: CalendarEventRecord[]
  tasksToday: TodoistTask[]
  tasksOverdue: TodoistTask[]
  completedYesterday: TodoistTask[]
  completedToday: TodoistTask[]
  slippedYesterday: TodoistTask[]
  tasksTomorrow: TodoistTask[]
  /** The newest night with any metrics — what "last night" means to Ace. */
  wellness: GarminWellnessRecord | null
  /** Up to two weeks of nights, newest first, for baselines and trends. */
  wellnessHistory: GarminWellnessRecord[]
  /** Garmin activities from the last four weeks, newest first. */
  activities: GarminHealthRecord[]
  /** Training-log rows from a week back to a week ahead, oldest first. */
  trainingPlan: TrainingRecord[]
  /** Races still ahead (or with no date yet), soonest first. */
  races: EventRecord[]
  /** Personal records from the Milestones card. */
  milestones: PersonalTrainingRecord[]
  /** Journal entries from the last two weeks, newest first. */
  journal: JournalEntryRecord[]
  /** Sources that failed, named for the UI so gaps are visible not silent. */
  gaps: string[]
}

const MAIL_LIMIT = 15
const WELLNESS_DAYS = 14
const ACTIVITY_DAYS = 28
const JOURNAL_DAYS = 14
const MILESTONE_LIMIT = 20

async function settle<T>(label: string, task: Promise<T>, gaps: string[], fallback: T): Promise<T> {
  try {
    return await task
  } catch {
    gaps.push(label)
    return fallback
  }
}

/**
 * The sheets hold dates as ISO keys, "9/9/2026", or "10/10/2026 6:30:00"
 * depending on who wrote the row. Returns a local 'YYYY-MM-DD', or '' for
 * anything else (including "TBD").
 */
export function sheetDateKey(value?: string): string {
  const text = String(value ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  }
  return ''
}

export async function buildAceContext(idToken: string, todoistConfigured: boolean): Promise<AceContext> {
  const gaps: string[] = []
  const now = new Date()
  const today = todayKey()
  const yesterday = addDaysToKey(today, -1)

  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowEnd.getDate() + 7)

  const [
    mail,
    calendar,
    active,
    completedYesterday,
    completedToday,
    wellness,
    activities,
    trainingRecords,
    races,
    personalTraining,
    journal,
  ] = await Promise.all([
    idToken
      ? settle('Gmail', getMail(idToken, MAIL_LIMIT), gaps, [] as MailSummaryRecord[])
      : Promise.resolve([] as MailSummaryRecord[]),
    idToken
      ? settle(
          'Calendar',
          getCalendarEvents(idToken, windowStart, windowEnd),
          gaps,
          { events: [] as CalendarEventRecord[], errors: [], appleConfigured: false },
        )
      : Promise.resolve({ events: [] as CalendarEventRecord[], errors: [], appleConfigured: false }),
    todoistConfigured
      ? settle('Todoist', getActiveTasks(), gaps, [] as TodoistTask[])
      : Promise.resolve([] as TodoistTask[]),
    todoistConfigured
      ? settle('Todoist history', getCompletedTasks(yesterday, yesterday), gaps, [] as TodoistTask[])
      : Promise.resolve([] as TodoistTask[]),
    todoistConfigured
      ? settle('Todoist today', getCompletedTasks(today, today), gaps, [] as TodoistTask[])
      : Promise.resolve([] as TodoistTask[]),
    settle('Garmin', getGarminWellness(), gaps, [] as GarminWellnessRecord[]),
    settle('Garmin activities', getGarminHealth(), gaps, [] as GarminHealthRecord[]),
    settle('Training log', getTrainingRecords(), gaps, [] as TrainingRecord[]),
    settle('Races', getEvents(), gaps, [] as EventRecord[]),
    settle('Milestones', getPersonalTraining(), gaps, [] as PersonalTrainingRecord[]),
    idToken
      ? settle('Journal', getJournalEntries(idToken), gaps, [] as JournalEntryRecord[])
      : Promise.resolve([] as JournalEntryRecord[]),
  ])

  const activityCutoff = addDaysToKey(today, -ACTIVITY_DAYS)
  const planStart = addDaysToKey(today, -7)
  const planEnd = addDaysToKey(today, 7)
  const journalCutoff = addDaysToKey(today, -JOURNAL_DAYS)

  return {
    now,
    mail,
    events: calendar.events,
    tasksToday: active.filter((task) => dueDateKey(task) === today),
    // Anything still open with a due date before today, newest first.
    tasksOverdue: active.filter((task) => {
      const key = dueDateKey(task)
      return Boolean(key) && key < today
    }),
    completedYesterday,
    completedToday,
    slippedYesterday: active.filter((task) => dueDateKey(task) === yesterday),
    tasksTomorrow: active.filter((task) => dueDateKey(task) === addDaysToKey(today, 1)),
    wellness: wellness[0] ?? null,
    wellnessHistory: wellness.slice(0, WELLNESS_DAYS),
    activities: activities
      .filter((activity) => activity.date.slice(0, 10) >= activityCutoff)
      .sort((a, b) => b.date.localeCompare(a.date)),
    // Only rows with something planned: the log is pre-filled with empty days.
    trainingPlan: trainingRecords
      .map((record) => ({ record, key: sheetDateKey(record.date) }))
      .filter(({ record, key }) => key >= planStart && key <= planEnd && (record.morning_workout || record.evening_workout))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ record }) => record),
    races: races
      .map((race) => ({ race, key: sheetDateKey(race.event_date) }))
      .filter(({ key }) => !key || key >= today)
      // Dated races first, soonest first; undated ("TBD") ones after.
      .sort((a, b) => (a.key || '9999').localeCompare(b.key || '9999'))
      .map(({ race }) => race),
    milestones: personalTraining.filter((row) => row.type === 'milestone').slice(0, MILESTONE_LIMIT),
    journal: journal.filter((entry) => entry.entry_date >= journalCutoff),
    gaps,
  }
}

function timeLabel(iso: string, allDay: boolean) {
  if (allDay) {
    return 'all day'
  }

  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function isToday(iso: string, now: Date) {
  const date = new Date(iso)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function dayLabel(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function taskLine(task: TodoistTask) {
  const due = task.due?.date ? ` (due ${task.due.date})` : ''
  const priority = task.priority >= 3 ? ' [high priority]' : ''
  return `- ${task.content}${due}${priority}`
}

/** Whether any source returned so much as one row. */
export function hasAnyData(context: AceContext) {
  return (
    context.mail.length > 0 ||
    context.events.length > 0 ||
    context.tasksToday.length > 0 ||
    context.tasksOverdue.length > 0 ||
    context.tasksTomorrow.length > 0 ||
    context.completedToday.length > 0 ||
    context.completedYesterday.length > 0 ||
    context.slippedYesterday.length > 0 ||
    context.wellness !== null ||
    context.activities.length > 0 ||
    context.trainingPlan.length > 0 ||
    context.races.length > 0 ||
    context.journal.length > 0
  )
}

/** Mean of the numeric values, rounded, or null when there are none. */
function average(values: string[], digits = 0) {
  const numbers = values.map(Number).filter((value) => value !== 0 && Number.isFinite(value))
  if (numbers.length === 0) {
    return null
  }
  const factor = 10 ** digits
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * factor) / factor
}

function nightLine(night: GarminWellnessRecord) {
  const sleepDetail = [
    night.sleep_duration_h && `${night.sleep_duration_h}h`,
    night.deep_sleep_h && `deep ${night.deep_sleep_h}h`,
    night.rem_sleep_h && `REM ${night.rem_sleep_h}h`,
  ]
    .filter(Boolean)
    .join(', ')

  const parts = [
    night.sleep_score && `sleep ${night.sleep_score}${sleepDetail ? ` (${sleepDetail})` : ''}`,
    !night.sleep_score && sleepDetail,
    night.hrv && `HRV ${night.hrv}`,
    night.resting_hr && `RHR ${night.resting_hr}`,
    night.stress_avg && `stress ${night.stress_avg}`,
    night.body_battery_high && `body battery ${night.body_battery_high}`,
    night.training_readiness && `readiness ${night.training_readiness}`,
  ].filter(Boolean)

  return `- ${night.date}: ${parts.join(', ') || 'no metrics'}`
}

/** Garmin's activity types collapsed to the disciplines a triathlete plans in. */
export function discipline(activityType: string) {
  const type = activityType.toLowerCase()
  if (type.includes('swim')) return 'swim'
  if (type.includes('cycl') || type.includes('bik') || type.includes('ride')) return 'bike'
  if (type.includes('run')) return 'run'
  if (type.includes('strength')) return 'strength'
  return 'other'
}

const DISCIPLINES = ['swim', 'bike', 'run', 'strength', 'other'] as const

/** Monday of the week containing `key`. */
function weekStart(key: string) {
  const date = dateFromKey(key)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toLocalDateKey(date)
}

/**
 * Per-week totals by discipline. Small models are poor at adding up a list of
 * activities, so the arithmetic is done here and handed over finished.
 */
function weeklyTotals(activities: GarminHealthRecord[]) {
  const weeks = new Map<string, Record<string, { count: number; minutes: number; miles: number }>>()

  for (const activity of activities) {
    const week = weekStart(activity.date.slice(0, 10))
    const totals = weeks.get(week) ?? {}
    const sport = discipline(activity.activity_type)
    const entry = totals[sport] ?? { count: 0, minutes: 0, miles: 0 }
    entry.count += 1
    entry.minutes += Number(activity.duration_min) || 0
    entry.miles += Number(activity.distance_mi) || 0
    totals[sport] = entry
    weeks.set(week, totals)
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, totals]) => {
      const parts = DISCIPLINES.filter((sport) => totals[sport]).map((sport) => {
        const { count, minutes, miles } = totals[sport]
        const distance = miles > 0 && sport !== 'strength' ? `, ${miles.toFixed(1)} mi` : ''
        return `${sport} ${count}× ${Math.round(minutes)} min${distance}`
      })
      const totalMinutes = Object.values(totals).reduce((sum, entry) => sum + entry.minutes, 0)
      return `- Week of ${dayLabel(week)}: ${parts.join('; ')} (total ${Math.round(totalMinutes)} min)`
    })
}

function activityLine(activity: GarminHealthRecord) {
  const parts = [
    activity.distance_mi && Number(activity.distance_mi) > 0 && `${activity.distance_mi} mi`,
    activity.duration_min && `${Math.round(Number(activity.duration_min))} min`,
    activity.avg_hr && `avg HR ${Math.round(Number(activity.avg_hr))}`,
    activity.tss && `TSS ${activity.tss}`,
  ].filter(Boolean)
  return `- ${activity.date.slice(0, 10)} ${discipline(activity.activity_type)}: ${activity.title || activity.activity_type}${
    parts.length ? ` — ${parts.join(', ')}` : ''
  }`
}

function planLine(record: TrainingRecord, today: string) {
  const key = sheetDateKey(record.date)
  const past = key < today
  const session = (label: string, workout: string | undefined, done: boolean) => {
    if (!workout) return ''
    const status = past ? (done ? ' (done)' : ' (missed)') : done ? ' (done)' : ''
    return `${label} ${workout}${status}`
  }
  const sessions = [
    session('AM:', record.morning_workout, record.completed_morning),
    session('PM:', record.evening_workout, record.completed_evening),
  ].filter(Boolean)
  return `- ${dayLabel(key)}${key === today ? ' (today)' : ''}: ${sessions.join('; ')}`
}

/** "Sat, Oct 10, 2026 (4 days away)" — the countdown is computed, not left to the model. */
function raceWhen(key: string, today: string) {
  if (!key) {
    return 'date TBD'
  }
  const date = dateFromKey(key)
  const days = Math.round((date.getTime() - dateFromKey(today).getTime()) / 86_400_000)
  const weeks = days >= 14 ? `, about ${Math.round(days / 7)} weeks` : ''
  const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return `${label} (${days} days away${weeks})`
}

function raceLine(race: EventRecord, today: string, isGoal: boolean) {
  const when = raceWhen(sheetDateKey(race.event_date), today)
  const kind = [race.type, race.measurement].filter(Boolean).join(', ')
  const location = race.location && race.location !== 'TBD' ? ` @ ${race.location}` : ''
  return `- ${when}: ${race.event_name}${kind ? ` — ${kind}` : ''}${location}${isGoal ? ' [current goal]' : ''}`
}

/**
 * The context rendered as plain text for the prompt.
 *
 * Written as terse labelled sections rather than JSON: small models follow a
 * readable outline more reliably than they parse nested objects, and it costs
 * fewer tokens.
 */
export function renderAceContext(context: AceContext) {
  const { now } = context
  const today = toLocalDateKey(now)
  const parts: string[] = []

  parts.push(
    `Today is ${now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}. The current time is ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`,
  )

  const unavailable =
    context.gaps.length > 0
      ? `## Unavailable\nThese sources could not be read, so say nothing about them: ${context.gaps.join(', ')}.`
      : ''

  // A run of "Nothing…" sections still reads like a template to fill in. One
  // blunt statement holds up better against a small model's urge to invent.
  if (!hasAnyData(context)) {
    parts.push(
      '## No data for today\nEvery source is empty: no mail, no calendar events, no tasks due, overdue, or completed, no watch or training data, and no journal entries. Say so plainly if asked. Do not list, summarise, or invent any items.',
    )
    if (unavailable) {
      parts.push(unavailable)
    }
    return parts.join('\n\n')
  }

  const todaysEvents = context.events.filter((event) => isToday(event.start, now))
  const laterEvents = context.events.filter((event) => !isToday(event.start, now)).slice(0, 8)

  parts.push(
    `## Today's schedule\n${
      todaysEvents.length === 0
        ? 'Nothing scheduled today.'
        : todaysEvents
            .map((event) => `- ${timeLabel(event.start, event.allDay)} — ${event.title}${event.location ? ` @ ${event.location}` : ''}`)
            .join('\n')
    }`,
  )

  if (laterEvents.length > 0) {
    parts.push(
      `## Coming up this week\n${laterEvents
        .map((event) => `- ${new Date(event.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — ${event.title}`)
        .join('\n')}`,
    )
  }

  parts.push(
    `## Unread and recent mail (${context.mail.filter((message) => message.unread).length} unread)\n${
      context.mail.length === 0
        ? 'No mail available.'
        : context.mail
            .slice(0, MAIL_LIMIT)
            .map(
              (message) =>
                `- ${message.unread ? '[unread] ' : ''}${message.important ? '[important] ' : ''}from ${message.from}: ${message.subject || '(no subject)'} — ${message.snippet.slice(0, 160)}`,
            )
            .join('\n')
    }`,
  )

  parts.push(
    `## Due today\n${
      context.tasksToday.length === 0 ? 'Nothing due today.' : context.tasksToday.map(taskLine).join('\n')
    }`,
  )

  if (context.tasksOverdue.length > 0) {
    parts.push(`## Overdue\n${context.tasksOverdue.slice(0, 15).map(taskLine).join('\n')}`)
  }

  parts.push(
    `## Due tomorrow\n${
      context.tasksTomorrow.length === 0 ? 'Nothing due tomorrow.' : context.tasksTomorrow.map(taskLine).join('\n')
    }`,
  )

  parts.push(
    `## Completed today\n${
      context.completedToday.length === 0
        ? 'Nothing completed yet today.'
        : `${context.completedToday.length} done: ${context.completedToday.map((task) => task.content).join('; ')}`
    }`,
  )

  parts.push(
    `## Yesterday\nCompleted ${context.completedYesterday.length}: ${
      context.completedYesterday.map((task) => task.content).join('; ') || 'nothing'
    }\nSlipped ${context.slippedYesterday.length}: ${
      context.slippedYesterday.map((task) => task.content).join('; ') || 'nothing'
    }`,
  )

  const wellness = context.wellness
  if (wellness) {
    const metrics = [
      wellness.sleep_score && `sleep score ${wellness.sleep_score}`,
      wellness.sleep_duration_h && `${wellness.sleep_duration_h}h asleep`,
      wellness.deep_sleep_h && `${wellness.deep_sleep_h}h deep`,
      wellness.rem_sleep_h && `${wellness.rem_sleep_h}h REM`,
      wellness.hrv && `HRV ${wellness.hrv}ms`,
      wellness.resting_hr && `resting HR ${wellness.resting_hr}bpm`,
      wellness.body_battery_high && `body battery peaked at ${wellness.body_battery_high}`,
      wellness.stress_avg && `average stress ${wellness.stress_avg}`,
      wellness.training_readiness && `training readiness ${wellness.training_readiness}`,
      wellness.training_status && `training status ${wellness.training_status}`,
      wellness.vo2_max && `VO2 max ${wellness.vo2_max}`,
    ].filter(Boolean)

    const stale = wellness.date < addDaysToKey(today, -1)
    parts.push(
      `## Last night and recovery (${wellness.date})\n${metrics.join(', ') || 'No metrics recorded.'}${
        stale
          ? `\nNOTE: the watch has not synced since ${wellness.date}. This is not last night's data - say so if you mention it.`
          : ''
      }`,
    )
  }

  if (context.wellnessHistory.length > 1) {
    const history = context.wellnessHistory
    const baseline = [
      ['sleep score', average(history.map((night) => night.sleep_score))],
      ['sleep', average(history.map((night) => night.sleep_duration_h), 1), 'h'],
      ['HRV', average(history.map((night) => night.hrv)), 'ms'],
      ['resting HR', average(history.map((night) => night.resting_hr)), 'bpm'],
      ['stress', average(history.map((night) => night.stress_avg))],
    ]
      .filter(([, value]) => value !== null)
      .map(([label, value, unit]) => `${label} ${value}${unit ?? ''}`)

    parts.push(
      `## Sleep and recovery, last ${history.length} nights\n${
        baseline.length ? `Averages (his baseline): ${baseline.join(', ')}.\n` : ''
      }${history.map(nightLine).join('\n')}`,
    )
  }

  if (context.activities.length > 0) {
    parts.push(
      `## Training done, last ${ACTIVITY_DAYS} days\nWeekly totals:\n${weeklyTotals(context.activities).join('\n')}\nRecent sessions:\n${context.activities
        .slice(0, 12)
        .map(activityLine)
        .join('\n')}`,
    )
  } else {
    parts.push(`## Training done, last ${ACTIVITY_DAYS} days\nNo activities recorded.`)
  }

  parts.push(
    `## Training log (planned workouts, a week back to a week ahead)\n${
      context.trainingPlan.length === 0
        ? 'Nothing planned in the training log for this window.'
        : context.trainingPlan.map((record) => planLine(record, today)).join('\n')
    }`,
  )

  if (context.races.length > 0) {
    // The first dated race is what training builds toward.
    const goal = context.races.find((race) => sheetDateKey(race.event_date))
    parts.push(
      `## Races ahead\n${context.races.map((race) => raceLine(race, today, race === goal)).join('\n')}`,
    )
  }

  if (context.milestones.length > 0) {
    parts.push(
      `## Personal records\n${context.milestones
        .map((row) => `- ${row.category ? `${row.category} ` : ''}${row.name}: ${row.value}`)
        .join('\n')}`,
    )
  }

  if (context.journal.length > 0) {
    const scores = context.journal.map((entry) => moodScore(entry.mood)).filter((score): score is number => score !== null)
    const moodAverage = scores.length
      ? ` Average mood ${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)} on a 1 (Rough) to 5 (Great) scale over ${scores.length} entries.`
      : ''
    const recent = context.journal.slice(0, 2).map((entry) => {
      const text = [entry.reflection, entry.body].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      return `- ${entry.entry_date}${entry.title ? ` "${entry.title}"` : ''}: ${text.slice(0, 400) || '(no text)'}`
    })
    parts.push(
      `## Mood and journal, last ${JOURNAL_DAYS} days\nPrivate and sensitive: use only to notice patterns, gently.${moodAverage}\n${context.journal
        .map((entry) => `- ${entry.entry_date}: ${entry.mood || 'no mood'}${entry.title ? ` — ${entry.title}` : ''}`)
        .join('\n')}\nMost recent entries:\n${recent.join('\n')}`,
    )
  } else {
    parts.push(`## Mood and journal, last ${JOURNAL_DAYS} days\nNo journal entries.`)
  }

  if (unavailable) {
    parts.push(unavailable)
  }

  return parts.join('\n\n')
}
